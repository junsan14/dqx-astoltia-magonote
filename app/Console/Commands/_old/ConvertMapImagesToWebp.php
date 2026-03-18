<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

class ConvertMapImagesToWebp extends Command
{
    protected $signature = 'maps:convert-webp
        {--disk=public : 対象Storageディスク}
        {--base=images/maps : 対象ベースディレクトリ}
        {--quality=90 : WebP quality}
        {--delete-original : 変換後に元画像を削除}
        {--dry-run : 実際には変換もDB更新もしない}
        {--only-ext= : 対象拡張子をカンマ区切りで指定。例 jpg,jpeg,png}
        {--table=map_layers : 更新対象テーブル}
        {--column=image_path : 更新対象カラム}';

    protected $description = 'maps配下の画像を一括でwebpへ変換し、DBの画像パスも更新する';

    public function handle(): int
    {
        $diskName = (string) $this->option('disk');
        $baseDir = trim((string) $this->option('base'), '/');
        $quality = (int) $this->option('quality');
        $deleteOriginal = (bool) $this->option('delete-original');
        $dryRun = (bool) $this->option('dry-run');
        $table = (string) $this->option('table');
        $column = (string) $this->option('column');

        $exts = $this->option('only-ext')
            ? array_filter(array_map('strtolower', array_map('trim', explode(',', (string) $this->option('only-ext')))))
            : ['jpg', 'jpeg', 'png'];

        $disk = Storage::disk($diskName);
        $rootPath = $disk->path($baseDir);

        if (!is_dir($rootPath)) {
            $this->error("対象ディレクトリが存在しない: {$rootPath}");
            return self::FAILURE;
        }

        if (!function_exists('imagewebp')) {
            $this->error('GDの imagewebp() が使えない。php-gd / WebP対応を確認して。');
            return self::FAILURE;
        }

        $this->line("disk: {$diskName}");
        $this->line("base: {$baseDir}");
        $this->line("root: {$rootPath}");
        $this->line("quality: {$quality}");
        $this->line("extensions: " . implode(', ', $exts));
        $this->line('dry-run: ' . ($dryRun ? 'yes' : 'no'));
        $this->line('delete-original: ' . ($deleteOriginal ? 'yes' : 'no'));
        $this->newLine();

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($rootPath, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        $targets = [];
        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }

            $ext = strtolower($file->getExtension());
            if (!in_array($ext, $exts, true)) {
                continue;
            }

            $absolutePath = $file->getPathname();
            $relativePath = str_replace('\\', '/', substr($absolutePath, strlen($disk->path(''))));
            $relativePath = ltrim($relativePath, '/');

            $targets[] = [
                'absolute' => $absolutePath,
                'relative' => $relativePath, // images/maps/tenseikyo/map_id_527/1.jpg
                'public_path' => 'storage/' . $relativePath, // storage/images/maps/...
            ];
        }

        if (empty($targets)) {
            $this->info('対象画像が見つからない');
            return self::SUCCESS;
        }

        $this->info('対象件数: ' . count($targets));

        $converted = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($targets as $index => $target) {
            $oldAbsolute = $target['absolute'];
            $oldRelative = $target['relative'];
            $oldPublicPath = $target['public_path'];

            $newRelative = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $oldRelative);
            $newPublicPath = 'storage/' . $newRelative;
            $newAbsolute = $disk->path($newRelative);

            $this->line('----------------------------------------');
            $this->line('[' . ($index + 1) . '/' . count($targets) . ']');
            $this->line("old: {$oldPublicPath}");
            $this->line("new: {$newPublicPath}");

            try {
                if ($dryRun) {
                    $dbCount = DB::table($table)->where($column, $oldPublicPath)->count();
                    $this->line("dry-run: DB更新候補 {$dbCount} 件");
                    $converted++;
                    continue;
                }

                if (!is_dir(dirname($newAbsolute))) {
                    mkdir(dirname($newAbsolute), 0775, true);
                }

                $image = $this->makeImageResource($oldAbsolute);
                if (!$image) {
                    $this->warn('画像読込失敗のためスキップ');
                    $errors++;
                    continue;
                }

                imagepalettetotruecolor($image);
                imagealphablending($image, true);
                imagesavealpha($image, true);

                $ok = imagewebp($image, $newAbsolute, $quality);
                imagedestroy($image);

                if (!$ok) {
                    $this->warn('webp変換失敗');
                    $errors++;
                    continue;
                }

                $converted++;

                $dbCount = DB::table($table)
                    ->where($column, $oldPublicPath)
                    ->update([$column => $newPublicPath]);

                $updated += $dbCount;
                $this->info("DB更新: {$dbCount} 件");

                if ($deleteOriginal && file_exists($newAbsolute)) {
                    @unlink($oldAbsolute);
                    $this->line('元画像削除: yes');
                } else {
                    $this->line('元画像削除: no');
                }
            } catch (Throwable $e) {
                $errors++;
                $this->error('例外: ' . $e->getMessage());
            }
        }

        $this->newLine();
        $this->info("変換件数: {$converted}");
        $this->info("DB更新件数: {$updated}");
        $this->info("スキップ/失敗: {$errors}");
        $this->info("完了");

        return self::SUCCESS;
    }

    private function makeImageResource(string $path)
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($ext) {
            'jpg', 'jpeg' => @imagecreatefromjpeg($path),
            'png' => @imagecreatefrompng($path),
            default => null,
        };
    }
}
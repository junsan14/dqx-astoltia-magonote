<?php

namespace App\Console\Commands;

use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

class ImportMonsterImagesSequentially extends Command
{
    protected $signature = 'monsters:import-images-sequential
                            {source : 元画像フォルダのパス}
                            {--start-display-order=3 : 開始する display_order}
                            {--only= : 特定ファイルだけ処理}
                            {--overwrite : 既存画像を上書きする}
                            {--save-name-copy : モンスター名ファイルも追加保存する}
                            {--dry-run : 保存せず確認だけする}
                            {--crop-x=260 : 左からの切り取り開始位置}
                            {--crop-y=160 : 上からの切り取り開始位置}
                            {--crop-size=350 : 正方形切り取りサイズ}
                            {--output-size=350 : 出力画像サイズ}
                            {--quality=76 : WebP quality}
                            {--sharpen=15 : sharpenの強さ}';

    protected $description = '元画像を取得順のまま monsters.display_order へ割り当て、固定位置から正方形で crop して webp 保存し、image_path を更新する';

    private ImageManager $manager;

    public function __construct()
    {
        parent::__construct();
        $this->manager = new ImageManager(new Driver());
    }

    public function handle(): int
    {
        $sourceDir = $this->argument('source');
        $startDisplayOrder = max(1, (int) $this->option('start-display-order'));
        $only = $this->option('only');
        $overwrite = (bool) $this->option('overwrite');
        $saveNameCopy = (bool) $this->option('save-name-copy');
        $dryRun = (bool) $this->option('dry-run');

        if (!is_dir($sourceDir)) {
            $this->error("フォルダが見つからない: {$sourceDir}");
            return self::FAILURE;
        }

        // 並び替えなし。取得順のまま処理する
        $files = collect(File::files($sourceDir))
            ->filter(function ($file) use ($only) {
                if ($only && $file->getFilename() !== $only) {
                    return false;
                }

                return in_array(strtolower($file->getExtension()), [
                    'jpg',
                    'jpeg',
                    'png',
                    'webp',
                ], true);
            })
            ->values();

        if ($files->isEmpty()) {
            $this->warn('対象画像がない');
            return self::SUCCESS;
        }

        Storage::disk('public')->makeDirectory('images/monsters');

        if ($saveNameCopy) {
            Storage::disk('public')->makeDirectory('images/monsters/by-name');
        }

        $success = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($files as $index => $file) {
            $displayOrder = $startDisplayOrder + $index;
            $path = $file->getPathname();
            $filename = $file->getFilename();

            $this->line('');
            $this->line("処理中: {$filename} => display_order {$displayOrder}");

            try {
                $monster = Monster::query()
                    ->where('display_order', $displayOrder)
                    ->first();

                if (!$monster) {
                    $this->warn("  monsters.display_order={$displayOrder} が存在しないためスキップ");
                    $skipped++;
                    continue;
                }

                $storagePath = "images/monsters/{$displayOrder}.webp";
                $publicPath = "/storage/{$storagePath}";

                $nameStoragePath = null;
                $namePublicPath = null;

                if ($saveNameCopy) {
                    $safeMonsterName = $this->sanitizeFileName($monster->name);
                    $orderPrefix = str_pad((string) $displayOrder, 3, '0', STR_PAD_LEFT);
                    $nameStoragePath = "images/monsters/by-name/{$orderPrefix}_{$safeMonsterName}.webp";
                    $namePublicPath = "/storage/{$nameStoragePath}";
                }

                $displayOrderExists = Storage::disk('public')->exists($storagePath);
                $nameExists = $nameStoragePath
                    ? Storage::disk('public')->exists($nameStoragePath)
                    : false;

                if (!$overwrite) {
                    if ($displayOrderExists) {
                        $this->warn("  display_order画像が既存のためスキップ: {$publicPath}");
                        $skipped++;
                        continue;
                    }

                    if ($saveNameCopy && $nameExists) {
                        $this->warn("  モンスター名画像が既存のためスキップ: {$namePublicPath}");
                        $skipped++;
                        continue;
                    }
                }

                if (!$dryRun) {
                    $encoded = $this->buildEncodedMonsterImage($path);

                    Storage::disk('public')->put($storagePath, $encoded);

                    if ($saveNameCopy && $nameStoragePath) {
                        Storage::disk('public')->put($nameStoragePath, $encoded);
                    }

                    $monster->image_path = $publicPath;
                    $monster->save();
                }

                $message = "  保存完了: {$publicPath} / {$monster->name} (id: {$monster->id}, display_order: {$monster->display_order})";

                if ($saveNameCopy && $namePublicPath) {
                    $message .= " / name-copy: {$namePublicPath}";
                }

                $this->info($message);
                $success++;
            } catch (\Throwable $e) {
                $this->error("  失敗: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->line('');
        $this->info("完了 success={$success} skipped={$skipped} failed={$failed}");

        return self::SUCCESS;
    }

    private function buildEncodedMonsterImage(string $sourcePath): string
    {
        $image = $this->manager->read($sourcePath);

        $originalWidth = $image->width();
        $originalHeight = $image->height();

        $cropX = max(0, (int) $this->option('crop-x'));
        $cropY = max(0, (int) $this->option('crop-y'));
        $cropSize = max(1, (int) $this->option('crop-size'));
        $outputSize = max(1, (int) $this->option('output-size'));
        $quality = max(1, min(100, (int) $this->option('quality')));
        $sharpen = max(0, (int) $this->option('sharpen'));

        if ($cropX >= $originalWidth || $cropY >= $originalHeight) {
            throw new \RuntimeException('切り取り開始位置が画像外になっている');
        }

        $srcSize = $cropSize;

        if ($cropX + $srcSize > $originalWidth) {
            $srcSize = $originalWidth - $cropX;
        }

        if ($cropY + $srcSize > $originalHeight) {
            $srcSize = min($srcSize, $originalHeight - $cropY);
        }

        if ($srcSize <= 0) {
            throw new \RuntimeException('切り取りサイズが不正');
        }

        $this->line("  crop: source({$cropX}, {$cropY}, {$srcSize}, {$srcSize})");

        $image->crop($srcSize, $srcSize, $cropX, $cropY);

        if ($sharpen > 0) {
            $image->sharpen($sharpen);
        }

        if ($image->width() !== $outputSize || $image->height() !== $outputSize) {
            $image->resize($outputSize, $outputSize);
        }

        return (string) $image->encode(new WebpEncoder(quality: $quality));
    }

    private function sanitizeFileName(string $name): string
    {
        $name = trim($name);

        $replaceMap = [
            '/' => '／',
            '\\' => '￥',
            ':' => '：',
            '*' => '＊',
            '?' => '？',
            '"' => '”',
            '<' => '＜',
            '>' => '＞',
            '|' => '｜',
        ];

        $name = strtr($name, $replaceMap);
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
        $name = trim($name);

        return $name !== '' ? $name : 'unknown-monster';
    }
}
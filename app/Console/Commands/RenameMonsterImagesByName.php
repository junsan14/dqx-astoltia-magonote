<?php

namespace App\Console\Commands;

use App\Models\Monster;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RenameMonsterImagesByName extends Command
{
    protected $signature = 'monsters:rename-images-by-name
                            {--dir= : 元画像ディレクトリ。省略時は storage/app/name}
                            {--copy : 元画像を残してコピーする}
                            {--dry-run : 実際には保存・更新しない}
                            {--clear-missing : 今回一致しなかった monster の image_path を null にする}';

    protected $description = '画像ファイル名のモンスター名を monsters.name と照合し、monster id で保存して image_path を更新する';

    public function handle(): int
    {
        $sourceDir = $this->option('dir')
            ? base_path($this->option('dir'))
            : storage_path('name');

        $copy = (bool) $this->option('copy');
        $dryRun = (bool) $this->option('dry-run');
        $clearMissing = (bool) $this->option('clear-missing');

        if (! is_dir($sourceDir)) {
            $this->error("元ディレクトリが見つからない: {$sourceDir}");
            return self::FAILURE;
        }

        $files = collect(scandir($sourceDir))
            ->filter(function ($file) use ($sourceDir) {
                if (in_array($file, ['.', '..'], true)) {
                    return false;
                }

                $fullPath = $sourceDir . DIRECTORY_SEPARATOR . $file;

                if (! is_file($fullPath)) {
                    return false;
                }

                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

                return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'], true);
            })
            ->values();

        if ($files->isEmpty()) {
            $this->warn("画像が見つからない: {$sourceDir}");

            if ($clearMissing && ! $dryRun) {
                Monster::query()->update(['image_path' => null]);
                $this->warn('画像が0件だったので、全 monster の image_path を null にした');
            }

            return self::SUCCESS;
        }

        $monsters = Monster::query()
            ->select(['id', 'name', 'image_path'])
            ->get();

        $monsterMap = $monsters->keyBy(function ($monster) {
            return $this->normalizeName($monster->name);
        });

        $savedCount = 0;
        $updatedCount = 0;
        $notFoundCount = 0;
        $skippedCount = 0;
        $clearedCount = 0;

        $matchedMonsterIds = [];

        $disk = Storage::disk('public');
        $targetDir = 'images/monsters'; // URLは /storage/images/monsters/{id}.{ext}

        if (! $disk->exists($targetDir) && ! $dryRun) {
            $disk->makeDirectory($targetDir);
        }

        foreach ($files as $fileName) {
            $sourcePath = $sourceDir . DIRECTORY_SEPARATOR . $fileName;
            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            $baseName = pathinfo($fileName, PATHINFO_FILENAME);

            $normalizedName = $this->normalizeName($baseName);
            $monster = $monsterMap->get($normalizedName);

            if (! $monster) {
                $this->warn("未一致: {$fileName}");
                $notFoundCount++;
                continue;
            }

            $newFileName = $monster->id . '.' . $ext;
            $storageRelativePath = $targetDir . '/' . $newFileName;
            $dbImagePath = '/storage/' . $storageRelativePath;

            $matchedMonsterIds[] = $monster->id;

            if ($dryRun) {
                $this->line("[dry-run] {$fileName} => {$dbImagePath}");
                $savedCount++;
                $updatedCount++;
                continue;
            }

            $stream = fopen($sourcePath, 'r');

            if ($stream === false) {
                $this->warn("読み込み失敗: {$fileName}");
                $skippedCount++;
                continue;
            }

            try {
                $disk->put($storageRelativePath, $stream);
            } finally {
                fclose($stream);
            }

            if (! $copy) {
                @unlink($sourcePath);
            }

            $monster->image_path = $dbImagePath;
            $monster->save();

            $this->info("更新: {$fileName} => {$dbImagePath}");

            $savedCount++;
            $updatedCount++;
        }

        if ($clearMissing) {
            $matchedMonsterIds = array_values(array_unique($matchedMonsterIds));

            $query = Monster::query();

            if (! empty($matchedMonsterIds)) {
                $query->whereNotIn('id', $matchedMonsterIds);
            }

            if ($dryRun) {
                $clearedCount = (clone $query)
                    ->whereNotNull('image_path')
                    ->count();

                $this->line("[dry-run] image_path クリア予定: {$clearedCount}件");
            } else {
                $clearedCount = (clone $query)
                    ->whereNotNull('image_path')
                    ->count();

                $query->update(['image_path' => null]);

                $this->warn("今回一致しなかった monster の image_path をクリア: {$clearedCount}件");
            }
        }

        $this->newLine();
        $this->info('完了');
        $this->line("保存: {$savedCount}");
        $this->line("DB更新: {$updatedCount}");
        $this->line("未一致ファイル: {$notFoundCount}");
        $this->line("スキップ: {$skippedCount}");
        $this->line("image_pathクリア: {$clearedCount}");

        return self::SUCCESS;
    }

    private function normalizeName(string $value): string
    {
        $value = trim($value);

        // 先頭の連番を除去
        // 003_いたずらもぐら -> いたずらもぐら
        // 12-スライム -> スライム
        // 001 ドラキー -> ドラキー
        $value = preg_replace('/^\d+\s*[_\-－—\.\s]*/u', '', $value);

        // 区切り文字のゆれを吸収
        $value = str_replace(['_', '-', '　'], ' ', $value);
        $value = preg_replace('/\s+/u', '', $value);

        if (class_exists(\Normalizer::class)) {
            $value = \Normalizer::normalize($value, \Normalizer::FORM_KC);
        }

        return mb_strtolower($value);
    }
}
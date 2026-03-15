<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class MoveMapLayerImages extends Command
{
    protected $signature = 'maps:move-layer-images
                            {--dry-run : 実際には移動・更新しない}
                            {--only-id= : 特定の map_layers.id だけ処理}
                            {--limit= : 先頭から指定件数だけ処理}';

    protected $description = '旧形式の map layer 画像を storage/images/maps/{continent}/map_id_{map_id}/{floor_no}.{ext} へ移動し、DBのimage_pathも更新する';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $onlyId = $this->option('only-id');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;

        $query = DB::table('map_layers')
            ->select([
                'id',
                'map_id',
                'floor_no',
                'image_path',
            ])
            ->whereNotNull('image_path')
            ->orderBy('id');

        if ($onlyId) {
            $query->where('id', (int) $onlyId);
        }

        if ($limit) {
            $query->limit($limit);
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            $this->warn('対象データなし');
            return self::SUCCESS;
        }

        $moved = 0;
        $updatedOnly = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($rows as $row) {
            $id = (int) $row->id;
            $mapId = (int) $row->map_id;
            $floorNo = (int) $row->floor_no;
            $imagePath = trim((string) $row->image_path);

            $this->newLine();
            $this->line("=== map_layer_id: {$id} ===");
            $this->line("old image_path: {$imagePath}");

            if ($imagePath === '') {
                $this->warn('SKIP: empty image_path');
                $skipped++;
                continue;
            }

            // すでに新形式ならスキップ
            if ($this->isAlreadyNewFormat($imagePath, $mapId)) {
                $this->info('SKIP: already new format');
                $skipped++;
                continue;
            }

            $continent = $this->extractContinentFromOldPath($imagePath);
            if (!$continent) {
                $this->error('FAIL: old image_path から continent を抽出できない');
                $failed++;
                continue;
            }

            $extension = $this->detectExtension($imagePath);
            if (!$extension) {
                $this->error('FAIL: 拡張子を判定できない');
                $failed++;
                continue;
            }

            $newRelativePath = "storage/images/maps/{$continent}/map_id_{$mapId}/{$floorNo}.{$extension}";
            $oldAbsolutePath = public_path($imagePath);
            $newAbsolutePath = public_path($newRelativePath);

            $this->line("continent    : {$continent}");
            $this->line("new image_path: {$newRelativePath}");
            $this->line("old absolute : {$oldAbsolutePath}");
            $this->line("new absolute : {$newAbsolutePath}");

            if ($dryRun) {
                if (File::exists($oldAbsolutePath)) {
                    $this->info('DRY-RUN: old file exists, move可能');
                } elseif (File::exists($newAbsolutePath)) {
                    $this->info('DRY-RUN: new file already exists, DB updateのみ候補');
                } else {
                    $this->warn('DRY-RUN: old/new ともにファイルなし');
                }
                continue;
            }

            if (File::exists($newAbsolutePath)) {
                DB::table('map_layers')
                    ->where('id', $id)
                    ->update([
                        'image_path' => $newRelativePath,
                        'updated_at' => now(),
                    ]);

                $this->info('UPDATED ONLY: new file already exists, DB image_path を更新');
                $updatedOnly++;
                continue;
            }

            if (!File::exists($oldAbsolutePath)) {
                $this->error('FAIL: old file not found');
                $failed++;
                continue;
            }

            $newDir = dirname($newAbsolutePath);
            if (!File::isDirectory($newDir)) {
                File::makeDirectory($newDir, 0755, true);
            }

            try {
                File::move($oldAbsolutePath, $newAbsolutePath);

                DB::table('map_layers')
                    ->where('id', $id)
                    ->update([
                        'image_path' => $newRelativePath,
                        'updated_at' => now(),
                    ]);

                $this->info('MOVED: file移動 + DB更新 完了');
                $moved++;
            } catch (\Throwable $e) {
                $this->error('FAIL: ' . $e->getMessage());
                $failed++;
            }
        }

        $this->newLine();
        $this->info('===== RESULT =====');
        $this->line("moved       : {$moved}");
        $this->line("updatedOnly : {$updatedOnly}");
        $this->line("skipped     : {$skipped}");
        $this->line("failed      : {$failed}");

        return self::SUCCESS;
    }

    private function isAlreadyNewFormat(string $path, int $mapId): bool
    {
        $quotedMapId = preg_quote((string) $mapId, '#');

        return (bool) preg_match(
            "#^storage/images/maps/.+/map_id_{$quotedMapId}/-?\d+\.(jpg|jpeg|png|webp)$#i",
            $path
        );
    }

    private function extractContinentFromOldPath(string $path): ?string
    {
        // 例:
        // storage/maps/ogreed_continent/map_id_119_map_layer_floor_no_2.jpg
        if (preg_match('#^storage/maps/([^/]+)/map_id_\d+_map_layer_floor_no_-?\d+\.(jpg|jpeg|png|webp)$#i', $path, $m)) {
            return $m[1];
        }

        return null;
    }

    private function detectExtension(string $path): ?string
    {
        if (preg_match('/\.(jpg|jpeg|png|webp)$/i', $path, $m)) {
            return strtolower($m[1]);
        }

        return null;
    }
}
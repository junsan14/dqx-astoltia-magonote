<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class ImportMonsterDropsFromDraquex extends Command
{
    protected $signature = 'dq10:import-monster-drops-draquex
                            {--refresh : 対象モンスターの既存dropを削除して入れ直す}
                            {--only= : 指定モンスター名だけ実行}
                            {--limit= : 先頭から指定件数だけ実行}';

    protected $description = 'draquex.com のモンスター詳細ページから通常ドロップ・レアドロップ・宝珠・装備を取得して monster_drops に投入する';

    private array $indexUrls = [
        'https://draquex.com/monster/field/0-a-gyou.php',
        'https://draquex.com/monster/field/0-ka-gyou.php',
        'https://draquex.com/monster/field/0-sa-gyou.php',
        'https://draquex.com/monster/field/0-ta-gyou.php',
        'https://draquex.com/monster/field/0-na-gyou.php',
        'https://draquex.com/monster/field/0-ha-gyou.php',
        'https://draquex.com/monster/field/0-ma-gyou.php',
        'https://draquex.com/monster/field/0-ya-gyou.php',
        'https://draquex.com/monster/field/0-ra-gyou.php',
        'https://draquex.com/monster/field/0-wa-gyou.php',
    ];

    public function handle(): int
    {
        $only = $this->option('only');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;

        $detailUrls = $this->collectDetailUrls();

        if ($limit && $limit > 0) {
            $detailUrls = array_slice($detailUrls, 0, $limit);
        }

        $this->info('detail urls found: ' . count($detailUrls));

        if (empty($detailUrls)) {
            $this->warn('detail url が取得できなかった');
            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar(count($detailUrls));
        $bar->start();

        foreach ($detailUrls as $detailUrl) {
            try {
                $data = $this->parseMonsterDetail($detailUrl);

                if (!$data) {
                    $this->newLine();
                    $this->warn("parse failed: {$detailUrl}");
                    $bar->advance();
                    continue;
                }

                if ($only && $data['monster_name'] !== $only) {
                    $bar->advance();
                    continue;
                }

                $monster = DB::table('monsters')
                    ->where('name', $data['monster_name'])
                    ->first();

                if (!$monster) {
                    $this->newLine();
                    $this->warn("monster not found: {$data['monster_name']} ({$detailUrl})");
                    $bar->advance();
                    continue;
                }

                $this->saveMonsterDrops(
                    (int) $monster->id,
                    $data['normal_drop'],
                    $data['rare_drop'],
                    $data['orbs'],
                    $data['equipments']
                );
            } catch (Throwable $e) {
                $this->newLine();
                $this->error("error on: {$detailUrl}");
                $this->error($e->getMessage());
            }

            $bar->advance();
            usleep(200000);
        }

        $bar->finish();
        $this->newLine();
        $this->info('done');

        return self::SUCCESS;
    }
private function collectDetailUrls(): array
{
    $urls = [];

    foreach ($this->indexUrls as $indexUrl) {
        $this->newLine();
        $this->info("fetch index: {$indexUrl}");

        $html = $this->fetchHtml($indexUrl);

        if (!$html) {
            $this->warn("failed index: {$indexUrl}");
            continue;
        }

        $crawler = new Crawler($html, $indexUrl);

        $count = 0;

        $crawler->filter('a')->each(function (Crawler $node) use (&$urls, &$count) {
            try {
                $text = trim($node->text(''));
                $href = trim((string) $node->attr('href'));

                if ($href === '') {
                    return;
                }

                // 相対URLを絶対URLに変換
                $absoluteUrl = $node->link()->getUri();

                $path = parse_url($absoluteUrl, PHP_URL_PATH) ?? '';

                // モンスター詳細だけ通す
                // 例: /monster/a-1.php
                if (
                    preg_match('#^/monster/[a-z0-9\-]+\.php$#i', $path)
                    && !str_contains($path, '/monster/field/')
                ) {
                    $urls[] = $absoluteUrl;
                    $count++;

                    if ($count <= 5) {
                        $this->line("found: {$text} => {$absoluteUrl}");
                    }
                }
            } catch (\Throwable $e) {
                // link() が失敗しても無視
            }
        });

        $this->info("current collected: " . count($urls));
    }

    $urls = array_values(array_unique($urls));

    $this->newLine();
    $this->info('detail urls found: ' . count($urls));

    return $urls;
}

    private function parseMonsterDetail(string $url): ?array
    {
        $html = $this->fetchHtml($url);

        if (!$html) {
            return null;
        }

        $crawler = new Crawler($html, $url);

        $monsterName = '';
        if ($crawler->filter('h1')->count()) {
            $monsterName = trim($crawler->filter('h1')->first()->text(''));
        }

        if ($monsterName === '') {
            return null;
        }

        $monsterName = $this->normalizeMonsterName($monsterName);

        $lines = preg_split("/\R/u", strip_tags($html));
        $lines = array_map(function ($line) {
            $line = html_entity_decode($line, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $line = preg_replace('/\x{00A0}/u', ' ', $line);
            $line = preg_replace('/[ \t]+/u', ' ', $line);
            return trim($line);
        }, $lines);
        $lines = array_values(array_filter($lines, fn ($line) => $line !== ''));

        $normalDrop = null;
        $rareDrop = null;
        $equipments = [];
        $orbs = [];

        // ドロップ
        $dropIndex = $this->findLineIndex($lines, 'ドロップアイテム(通ドロ/レアドロ)');
        if ($dropIndex !== null) {
            $dropLines = $this->sliceUntilNextSection($lines, $dropIndex + 1);

            $dropCandidates = [];
            foreach ($dropLines as $line) {
                if (!$this->looksLikeListContent($line)) {
                    continue;
                }

                $name = $this->cleanupDropText($line);
                if ($name !== '') {
                    $dropCandidates[] = $name;
                }
            }

            $dropCandidates = array_values(array_unique($dropCandidates));

            $normalDrop = $dropCandidates[0] ?? null;
            $rareDrop   = $dropCandidates[1] ?? null;
        }

        // 装備
        $equipmentIndex = $this->findSectionIndexByRegex($lines, '/が落とす装備/u');
        if ($equipmentIndex !== null) {
            $equipmentLines = $this->sliceUntilNextSection($lines, $equipmentIndex + 1);

            foreach ($equipmentLines as $line) {
                if (!$this->looksLikeListContent($line)) {
                    continue;
                }

                $name = $this->cleanupEquipmentText($line);
                if ($name !== '') {
                    $equipments[] = $name;
                }
            }
        }

        // 宝珠
        $orbIndex = $this->findSectionIndexByRegex($lines, '/が落とす宝珠/u');
        if ($orbIndex !== null) {
            $orbLines = $this->sliceUntilNextSection($lines, $orbIndex + 1);

            foreach ($orbLines as $line) {
                if (!$this->looksLikeListContent($line)) {
                    continue;
                }

                $name = $this->cleanupOrbText($line);
                if ($name !== '') {
                    $orbs[] = $name;
                }
            }
        }

        return [
            'monster_name' => $monsterName,
            'normal_drop'  => $normalDrop,
            'rare_drop'    => $rareDrop,
            'equipments'   => array_values(array_unique($equipments)),
            'orbs'         => array_values(array_unique($orbs)),
            'url'          => $url,
        ];
    }

    private function saveMonsterDrops(
        int $monsterId,
        ?string $normalDrop,
        ?string $rareDrop,
        array $orbs,
        array $equipments
    ): void {
        if ($this->option('refresh')) {
            DB::table('monster_drops')
                ->where('monster_id', $monsterId)
                ->delete();
        }

        // 通常ドロップ
        if ($normalDrop) {
            $item = DB::table('items')
                ->where('name', $normalDrop)
                ->first();

            if ($item) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'item',
                    (int) $item->id,
                    'normal',
                    1
                );
            } else {
                $this->warn("normal item not found: {$normalDrop}");
            }
        }

        // レアドロップ
        if ($rareDrop) {
            $item = DB::table('items')
                ->where('name', $rareDrop)
                ->first();

            if ($item) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'item',
                    (int) $item->id,
                    'rare',
                    2
                );
            } else {
                $this->warn("rare item not found: {$rareDrop}");
            }
        }

        // オーブ
        foreach (array_values($orbs) as $index => $orbName) {
            $orb = DB::table('orbs')
                ->where('name', $orbName)
                ->first();

            if ($orb) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'orb',
                    (int) $orb->id,
                    'orb',
                    $index + 1
                );
            } else {
                $this->warn("orb not found: {$orbName}");
            }
        }

        // 装備
        foreach (array_values($equipments) as $index => $equipmentName) {
            $equipment = DB::table('equipments')
                ->where('name', $equipmentName)
                ->first();

            if ($equipment) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'equipment',
                    (int) $equipment->id,
                    'equipment',
                    $index + 1
                );
            } else {
                $this->warn("equipment not found: {$equipmentName}");
            }
        }
    }

    private function insertDropIfNotExists(
        int $monsterId,
        string $dropTargetType,
        int $dropTargetId,
        string $dropType,
        int $sortOrder
    ): void {
        $exists = DB::table('monster_drops')
            ->where('monster_id', $monsterId)
            ->where('drop_target_type', $dropTargetType)
            ->where('drop_target_id', $dropTargetId)
            ->where('drop_type', $dropType)
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('monster_drops')->insert([
            'monster_id'       => $monsterId,
            'drop_target_type' => $dropTargetType,
            'drop_target_id'   => $dropTargetId,
            'drop_type'        => $dropType,
            'sort_order'       => $sortOrder,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

   private function fetchHtml(string $url): ?string
{
    try {
        $response = Http::withOptions([
                'verify' => false,          // SSL検証を切る
                'allow_redirects' => true,
                'http_errors' => false,
                'timeout' => 30,
                'connect_timeout' => 15,
            ])
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                'Cache-Control' => 'no-cache',
                'Pragma' => 'no-cache',
            ])
            ->get($url);

        $this->line("status: {$response->status()} url: {$url}");

        if (!$response->successful()) {
            $bodyPreview = mb_substr($response->body(), 0, 300);
            $this->warn("http failed: {$url}");
            $this->warn("status: {$response->status()}");
            if ($bodyPreview !== '') {
                $this->warn("body: " . $bodyPreview);
            }
            return null;
        }

        $html = $response->body();

        if (trim($html) === '') {
            $this->warn("empty body: {$url}");
            return null;
        }

        return $html;
    } catch (\Throwable $e) {
        $this->warn("fetch exception: {$url}");
        $this->warn($e->getMessage());

        // cURL直叩き fallback
        if (function_exists('curl_init')) {
            try {
                $ch = curl_init($url);

                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_CONNECTTIMEOUT => 15,
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    CURLOPT_HTTPHEADER => [
                        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language: ja,en-US;q=0.9,en;q=0.8',
                        'Cache-Control: no-cache',
                        'Pragma: no-cache',
                    ],
                ]);

                $html = curl_exec($ch);
                $errno = curl_errno($ch);
                $error = curl_error($ch);
                $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                $this->line("curl status: {$status} url: {$url}");

                if ($errno) {
                    $this->warn("curl error: {$error}");
                    return null;
                }

                if ($status >= 200 && $status < 300 && is_string($html) && trim($html) !== '') {
                    return $html;
                }

                $this->warn("curl failed: {$url}");
                return null;
            } catch (\Throwable $e2) {
                $this->warn("curl exception: " . $e2->getMessage());
            }
        }

        return null;
    }
}

    private function normalizeMonsterName(string $name): string
    {
        $name = strip_tags($name);
        $name = html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $name = preg_replace('/\s*\(.+?\)\s*/u', '', $name);
        $name = preg_replace('/[ \t]+/u', ' ', $name);
        return trim($name);
    }

    private function cleanupDropText(string $text): string
    {
        $text = strip_tags($text);
        $text = preg_replace('/^\s*[●■□◆◇▼▽▶▷・]\s*/u', '', $text);
        $text = preg_replace('/\s*\(.+$/u', '', $text);
        $text = preg_replace('/\s{2,}/u', ' ', $text);
        return trim($text);
    }

    private function cleanupEquipmentText(string $text): string
    {
        $text = strip_tags($text);
        $text = preg_replace('/^\s*[●■□◆◇▼▽▶▷・]\s*/u', '', $text);
        $text = preg_replace('/\s*\(.+$/u', '', $text);
        $text = preg_replace('/^\s*［.+?］\s*/u', '', $text);
        $text = preg_replace('/^\s*【.+?】\s*/u', '', $text);
        $text = preg_replace('/\s{2,}/u', ' ', $text);
        return trim($text);
    }

    private function cleanupOrbText(string $text): string
    {
        $text = strip_tags($text);
        $text = preg_replace('/^\s*[●■□◆◇▼▽▶▷・]\s*/u', '', $text);
        $text = preg_replace('/^\s*〖[^〗]+〗\s*/u', '', $text);
        $text = preg_replace('/^\s*［[^］]+］\s*/u', '', $text);
        $text = preg_replace('/^\s*【[^】]+】\s*/u', '', $text);
        $text = preg_replace('/\s*\(.+$/u', '', $text);
        $text = preg_replace('/\s{2,}/u', ' ', $text);
        return trim($text);
    }

    private function findLineIndex(array $lines, string $needle): ?int
    {
        foreach ($lines as $i => $line) {
            if ($line === $needle) {
                return $i;
            }
        }

        return null;
    }

    private function findSectionIndexByRegex(array $lines, string $pattern): ?int
    {
        foreach ($lines as $i => $line) {
            if (preg_match($pattern, $line)) {
                return $i;
            }
        }

        return null;
    }

    private function sliceUntilNextSection(array $lines, int $start): array
    {
        $result = [];

        for ($i = $start; $i < count($lines); $i++) {
            $line = $lines[$i];

            if ($this->isSectionHeader($line)) {
                break;
            }

            $result[] = $line;
        }

        return $result;
    }

    private function isSectionHeader(string $line): bool
    {
        return (bool) preg_match(
            '/^(ドロップアイテム\(通ドロ\/レアドロ\)|.+が落とす装備|.+が落とす宝珠|便利な一覧表|どのあたりにいるか|.+がいる地域|系統|HP|MP|攻撃力|守備力|経験値|特訓スタンプ|ゴールド|弱点属性|耐性属性|生息地|備考)$/u',
            $line
        );
    }

    private function looksLikeListContent(string $line): bool
    {
        if ($line === '') {
            return false;
        }

        if ($line === '* * *') {
            return false;
        }

        if (preg_match('/^(系統|HP|MP|攻撃力|守備力|経験値|特訓スタンプ|ゴールド|弱点属性|耐性属性|生息地|備考)$/u', $line)) {
            return false;
        }

        if (preg_match('/^※/u', $line)) {
            return false;
        }

        if (str_contains($line, 'モンスター一覧')) {
            return false;
        }

        return true;
    }
}

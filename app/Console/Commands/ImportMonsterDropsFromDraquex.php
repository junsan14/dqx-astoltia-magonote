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
                            {--fresh : monster_drops テーブルを全削除して入れ直す}
                            {--only= : 指定モンスター名だけ実行}
                            {--limit= : 先頭から指定件数だけ実行}';

    protected $description = 'draquex.com のモンスター詳細ページからドロップ情報を取得して monster_drops に投入する';

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

    private array $missingRows = [];

    public function handle(): int
    {
        $only = $this->option('only');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;
        $fresh = (bool) $this->option('fresh');

        if ($fresh) {
            $this->warn('fresh mode: monster_drops テーブルを全削除してIDもリセットする');

            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            DB::table('monster_drops')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        }

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
                    $this->recordMissing(
                        $data['monster_name'],
                        $detailUrl,
                        'monster',
                        $data['monster_name'],
                        'monsters.name で見つからない'
                    );

                    $this->newLine();
                    $this->warn("monster not found: {$data['monster_name']} ({$detailUrl})");
                    $bar->advance();
                    continue;
                }

                $this->saveMonsterDrops(
                    (int) $monster->id,
                    $data['monster_name'],
                    $detailUrl,
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

        $csvPath = $this->exportMissingRowsCsv();

        if ($csvPath) {
            $this->warn("missing csv exported: {$csvPath}");
        } else {
            $this->info('missing data はなかった');
        }

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

                    $absoluteUrl = $node->link()->getUri();
                    $path = parse_url($absoluteUrl, PHP_URL_PATH) ?? '';

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
                } catch (Throwable $e) {
                    // ignore
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
        string $monsterName,
        string $sourceUrl,
        ?string $normalDrop,
        ?string $rareDrop,
        array $orbs,
        array $equipments
    ): void {
        if ($normalDrop) {
            $item = $this->findBestMatch('items', ['name'], $normalDrop);

            if ($item) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'item',
                    (int) $item->id,
                    'normal',
                    1
                );
            } else {
                $this->recordMissing(
                    $monsterName,
                    $sourceUrl,
                    'normal_item',
                    $normalDrop,
                    'items.name で見つからない'
                );
                $this->warn("normal item not found: {$normalDrop}");
            }
        }

        if ($rareDrop) {
            $item = $this->findBestMatch('items', ['name'], $rareDrop);

            if ($item) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'item',
                    (int) $item->id,
                    'rare',
                    2
                );
            } else {
                $accessory = $this->findBestMatch('accessories', ['name', 'item_name'], $rareDrop);

                if ($accessory) {
                    $this->insertDropIfNotExists(
                        $monsterId,
                        'accessory',
                        (int) $accessory->id,
                        'rare',
                        2
                    );
                } else {
                    $this->recordMissing(
                        $monsterName,
                        $sourceUrl,
                        'rare_item_or_accessory',
                        $rareDrop,
                        'items.name / accessories.name / accessories.item_name で見つからない'
                    );
                    $this->warn("rare drop not found in items/accessories: {$rareDrop}");
                }
            }
        }

        foreach (array_values($orbs) as $index => $orbName) {
            $orb = $this->findBestMatch('orbs', ['name'], $orbName);

            if ($orb) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'orb',
                    (int) $orb->id,
                    'orb',
                    $index + 1
                );
            } else {
                $this->recordMissing(
                    $monsterName,
                    $sourceUrl,
                    'orb',
                    $orbName,
                    'orbs.name で見つからない'
                );
                $this->warn("orb not found: {$orbName}");
            }
        }

        foreach (array_values($equipments) as $index => $equipmentName) {
            $equipment = $this->findBestMatch('equipments', ['item_name'], $equipmentName);

            if ($equipment) {
                $this->insertDropIfNotExists(
                    $monsterId,
                    'equipment',
                    (int) $equipment->id,
                    'equipment',
                    $index + 1
                );
            } else {
                $this->recordMissing(
                    $monsterName,
                    $sourceUrl,
                    'equipment',
                    $equipmentName,
                    'equipments.item_name で見つからない'
                );
                $this->warn("equipment not found: {$equipmentName}");
            }
        }
    }

    private function findBestMatch(string $table, array $columns, string $rawValue): ?object
    {
        $rawValue = trim($rawValue);
        if ($rawValue === '') {
            return null;
        }

        foreach ($columns as $column) {
            $row = DB::table($table)
                ->where($column, $rawValue)
                ->first();

            if ($row) {
                return $row;
            }
        }

        $normalizedInput = $this->normalizeForCompare($rawValue);

        foreach ($columns as $column) {
            $likeRows = DB::table($table)
                ->select(['id', $column])
                ->where($column, 'like', '%' . $rawValue . '%')
                ->limit(10)
                ->get();

            $best = $this->pickBestCandidateFromRows($likeRows, $column, $normalizedInput);
            if ($best) {
                return DB::table($table)->where('id', $best->id)->first();
            }
        }

        foreach ($columns as $column) {
            $likeRows = DB::table($table)
                ->select(['id', $column])
                ->where($column, 'like', '%' . mb_substr($rawValue, 0, max(1, mb_strlen($rawValue) - 1)) . '%')
                ->limit(30)
                ->get();

            $best = $this->pickBestCandidateFromRows($likeRows, $column, $normalizedInput);
            if ($best) {
                return DB::table($table)->where('id', $best->id)->first();
            }
        }

        foreach ($columns as $column) {
            $allRows = DB::table($table)
                ->select(['id', $column])
                ->get();

            $best = $this->pickBestCandidateFromRows($allRows, $column, $normalizedInput);
            if ($best) {
                return DB::table($table)->where('id', $best->id)->first();
            }
        }

        return null;
    }

    private function pickBestCandidateFromRows($rows, string $column, string $normalizedInput): ?object
    {
        $bestRow = null;
        $bestScore = PHP_INT_MAX;
        $inputLen = mb_strlen($normalizedInput);

        foreach ($rows as $row) {
            $candidate = (string) ($row->{$column} ?? '');
            if ($candidate === '') {
                continue;
            }

            $normalizedCandidate = $this->normalizeForCompare($candidate);

            if ($normalizedCandidate === '') {
                continue;
            }

            if ($normalizedCandidate === $normalizedInput) {
                return $row;
            }

            if (
                str_contains($normalizedCandidate, $normalizedInput)
                || str_contains($normalizedInput, $normalizedCandidate)
            ) {
                $lenDiff = abs(mb_strlen($normalizedCandidate) - $inputLen);
                if ($lenDiff <= 2) {
                    return $row;
                }
            }

            $distance = levenshtein(
                $this->toAsciiComparable($normalizedInput),
                $this->toAsciiComparable($normalizedCandidate)
            );

            $candidateLen = mb_strlen($normalizedCandidate);
            $lenDiff = abs($candidateLen - $inputLen);

            if ($inputLen <= 4) {
                $threshold = 1;
            } elseif ($inputLen <= 8) {
                $threshold = 2;
            } else {
                $threshold = 3;
            }

            if ($lenDiff > 3) {
                continue;
            }

            if ($distance <= $threshold && $distance < $bestScore) {
                $bestScore = $distance;
                $bestRow = $row;
            }
        }

        return $bestRow;
    }

    private function normalizeForCompare(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = mb_convert_kana($value, 'asKV', 'UTF-8');
        $value = preg_replace('/\x{00A0}/u', ' ', $value);
        $value = preg_replace('/[[:space:]]+/u', '', $value);

        $value = str_replace([
            '・', '･', '—', '―', '‐', '-', 'ｰ', '－',
            '（', '）', '(', ')', '【', '】', '[', ']',
            '「', '」', '『', '』', '〈', '〉', '《', '》',
            '：', ':', '　', '／', '/', '，', '、', '。',
            '＋', '+', '％', '%', '！', '？', '!',
            '?', '　'
        ], '', $value);

        $value = trim($value);

        return $value;
    }

    private function toAsciiComparable(string $value): string
    {
        $map = [
            'ア' => 'a','イ' => 'i','ウ' => 'u','エ' => 'e','オ' => 'o',
            'カ' => 'ka','キ' => 'ki','ク' => 'ku','ケ' => 'ke','コ' => 'ko',
            'サ' => 'sa','シ' => 'si','ス' => 'su','セ' => 'se','ソ' => 'so',
            'タ' => 'ta','チ' => 'ti','ツ' => 'tu','テ' => 'te','ト' => 'to',
            'ナ' => 'na','ニ' => 'ni','ヌ' => 'nu','ネ' => 'ne','ノ' => 'no',
            'ハ' => 'ha','ヒ' => 'hi','フ' => 'hu','ヘ' => 'he','ホ' => 'ho',
            'マ' => 'ma','ミ' => 'mi','ム' => 'mu','メ' => 'me','モ' => 'mo',
            'ヤ' => 'ya','ユ' => 'yu','ヨ' => 'yo',
            'ラ' => 'ra','リ' => 'ri','ル' => 'ru','レ' => 're','ロ' => 'ro',
            'ワ' => 'wa','ヲ' => 'wo','ン' => 'n',
            'ガ' => 'ga','ギ' => 'gi','グ' => 'gu','ゲ' => 'ge','ゴ' => 'go',
            'ザ' => 'za','ジ' => 'zi','ズ' => 'zu','ゼ' => 'ze','ゾ' => 'zo',
            'ダ' => 'da','ヂ' => 'di','ヅ' => 'du','デ' => 'de','ド' => 'do',
            'バ' => 'ba','ビ' => 'bi','ブ' => 'bu','ベ' => 'be','ボ' => 'bo',
            'パ' => 'pa','ピ' => 'pi','プ' => 'pu','ペ' => 'pe','ポ' => 'po',
            'ャ' => 'ya','ュ' => 'yu','ョ' => 'yo','ッ' => 'tu',
            'ァ' => 'a','ィ' => 'i','ゥ' => 'u','ェ' => 'e','ォ' => 'o',
            'ヴ' => 'vu',
        ];

        $converted = strtr($value, $map);
        $converted = mb_strtolower($converted, 'UTF-8');

        return preg_replace('/[^a-z0-9]/', '', $converted) ?? '';
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
                    'verify' => false,
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
        } catch (Throwable $e) {
            $this->warn("fetch exception: {$url}");
            $this->warn($e->getMessage());

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
                } catch (Throwable $e2) {
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

    private function recordMissing(
        string $monsterName,
        string $sourceUrl,
        string $category,
        string $rawName,
        string $note
    ): void {
        $key = implode('|', [$monsterName, $sourceUrl, $category, $rawName, $note]);

        foreach ($this->missingRows as $row) {
            $rowKey = implode('|', [
                $row['monster_name'],
                $row['source_url'],
                $row['category'],
                $row['raw_name'],
                $row['note'],
            ]);

            if ($rowKey === $key) {
                return;
            }
        }

        $this->missingRows[] = [
            'monster_name' => $monsterName,
            'source_url'   => $sourceUrl,
            'category'     => $category,
            'raw_name'     => $rawName,
            'note'         => $note,
        ];
    }

    private function exportMissingRowsCsv(): ?string
    {
        if (empty($this->missingRows)) {
            return null;
        }

        $dir = storage_path('app');
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $path = $dir . DIRECTORY_SEPARATOR . 'missing_monster_drops_' . now()->format('Ymd_His') . '.csv';

        $fp = fopen($path, 'w');

        if ($fp === false) {
            $this->error('missing csv の作成に失敗した');
            return null;
        }

        fwrite($fp, "\xEF\xBB\xBF");

        fputcsv($fp, [
            'monster_name',
            'source_url',
            'category',
            'raw_name',
            'note',
        ]);

        foreach ($this->missingRows as $row) {
            fputcsv($fp, [
                $row['monster_name'],
                $row['source_url'],
                $row['category'],
                $row['raw_name'],
                $row['note'],
            ]);
        }

        fclose($fp);

        return $path;
    }
}
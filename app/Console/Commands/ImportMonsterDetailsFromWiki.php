<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class ImportMonsterDetailsFromWiki extends Command
{
    protected $signature = 'dq10:import-monster-details-from-wiki
                            {--offset=0 : 開始位置}
                            {--limit=300 : 取得件数}
                            {--sleep=2000 : 1件ごとの待機ミリ秒}
                            {--only-missing : system_type / drop が未入力のものだけ対象}';

    protected $description = 'Import system_type, normal_drop, rare_drop from DQ10 wiki';

    private string $listUrl = 'https://wikiwiki.jp/dq10dic2nd/%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC/%E5%9B%B3%E9%91%91%E9%A0%86%E4%B8%80%E8%A6%A7';

    public function handle(): int
    {
        $offset = (int) $this->option('offset');
        $limit  = (int) $this->option('limit');
        $sleep  = (int) $this->option('sleep');
        $onlyMissing = (bool) $this->option('only-missing');

        $this->info('一覧ページ取得中...');
        $listHtml = $this->fetchHtml($this->listUrl);
        if (!$listHtml) {
            $this->error('一覧ページの取得に失敗した');
            return self::FAILURE;
        }

        $urlMap = $this->buildMonsterUrlMap($listHtml);

        if (empty($urlMap)) {
            $this->error('モンスターURL一覧を作れなかった');
            return self::FAILURE;
        }

        $query = DB::table('monsters')->orderBy('id');

        if ($onlyMissing) {
            $query->where(function ($q) {
                $q->whereNull('system_type')
                  ->orWhereNull('normal_drop')
                  ->orWhereNull('rare_drop');
            });
        }

        $monsters = $query->offset($offset)->limit($limit)->get(['id', 'name']);

        if ($monsters->isEmpty()) {
            $this->warn('対象モンスターがいない');
            return self::SUCCESS;
        }

        $this->info("対象件数: {$monsters->count()}");

        $bar = $this->output->createProgressBar($monsters->count());
        $bar->start();

        foreach ($monsters as $monster) {
            $name = trim($monster->name);

            $detailUrl = $urlMap[$name] ?? null;

            if (!$detailUrl) {
                $this->newLine();
                $this->warn("URL未発見: {$name}");
                $bar->advance();
                usleep($sleep * 1000);
                continue;
            }

            $detailHtml = $this->fetchHtml($detailUrl);

            if (!$detailHtml) {
                $this->newLine();
                $this->warn("詳細取得失敗: {$name}");
                $bar->advance();
                usleep($sleep * 1000);
                continue;
            }

            $text = $this->htmlToText($detailHtml);

            $parsed = $this->parseMonsterPage($text);

            DB::table('monsters')
                ->where('id', $monster->id)
                ->update([
                    'system_type' => $parsed['system_type'],
                    'normal_drop' => $parsed['normal_drop'],
                    'rare_drop'   => $parsed['rare_drop'],
                    'source_url'  => $detailUrl,
                    'updated_at'  => now(),
                ]);

            $bar->advance();
            usleep($sleep * 1000);
        }

        $bar->finish();
        $this->newLine(2);
        $this->info('完了');

        return self::SUCCESS;
    }

private function fetchHtml(string $url): ?string
{
    try {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Accept-Language: ja,en-US;q=0.9,en;q=0.8',
                    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Connection: close',
                ]),
                'timeout' => 30,
                'ignore_errors' => true,
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $html = file_get_contents($url, false, $context);

        if ($html === false || $html === '') {
            return null;
        }

        return $html;
    } catch (\Throwable $e) {
        $this->error($e->getMessage());
        return null;
    }
}

private function buildMonsterUrlMap(string $html): array
{
    $map = [];

    preg_match_all(
        '/<a[^>]+href="([^"]+)"[^>]*title="【([^】]+)】"[^>]*>【([^】]+)】<\/a>/u',
        $html,
        $matches,
        PREG_SET_ORDER
    );

    foreach ($matches as $m) {
        $href = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $titleName = trim($m[2]);
        $linkName = trim($m[3]);

        $name = $titleName ?: $linkName;

        if ($href === '' || $name === '') {
            continue;
        }

        $map[$name] = $this->absoluteUrl($href);
    }

    $this->info('URL map count: ' . count($map));

    return $map;
}

private function absoluteUrl(string $href): string
{
    if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
        return $href;
    }

    return 'https://wikiwiki.jp' . $href;
}

    private function htmlToText(string $html): string
    {
        $crawler = new Crawler($html);

        // 本文エリアを優先
        foreach (['#body', '.body', '#content', 'main'] as $selector) {
            if ($crawler->filter($selector)->count() > 0) {
                $text = $crawler->filter($selector)->text('', true);
                return $this->normalizeText($text);
            }
        }

        return $this->normalizeText(strip_tags($html));
    }

    private function normalizeText(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace("/[ \t]+/u", ' ', $text);
        $text = preg_replace("/\n{2,}/u", "\n", $text);
        return trim($text);
    }

    private function parseMonsterPage(string $text): array
{
    $systemType = null;
    $normalDrop = null;
    $rareDrop = null;

    $lines = preg_split("/\r\n|\n|\r/", $text);

    // 1. system_type:
    // 先頭付近の行から最初の【...系】を拾う
    foreach (array_slice($lines, 0, 20) as $line) {
        if (preg_match('/[【〖]([^【】〖〗\n]+?系)[】〗]/u', $line, $m)) {
            $systemType = trim($m[1]);
            break;
        }
    }

    // 2. normal_drop / rare_drop:
    // 行単位で見て、キーワードを含む行から【...】を拾う
    foreach ($lines as $line) {
        if ($normalDrop === null && mb_strpos($line, '通常ドロップ') !== false) {
            if (preg_match('/通常ドロップ[^【〖]*[【〖]([^【】〖〗]+)[】〗]/u', $line, $m)) {
                $normalDrop = trim($m[1]);
            }
        }

        if ($rareDrop === null && mb_strpos($line, 'レアドロップ') !== false) {
            if (preg_match('/レアドロップ[^【〖]*[【〖]([^【】〖〗]+)[】〗]/u', $line, $m)) {
                $rareDrop = trim($m[1]);
            }
        }

        if ($systemType && $normalDrop && $rareDrop) {
            break;
        }
    }

    return [
        'system_type' => $systemType,
        'normal_drop' => $normalDrop,
        'rare_drop'   => $rareDrop,
    ];
}

    private function cleanupItemText(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/[【】〖〗\[\]]/u', '', $value);
        $value = preg_replace('/^.*?([^、。]+)$/u', '$1', $value);
        return trim($value);
    }
}

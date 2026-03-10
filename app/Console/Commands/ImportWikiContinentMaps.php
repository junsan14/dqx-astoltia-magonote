<?php

namespace App\Console\Commands;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportWikiContinentMaps extends Command
{
    protected $signature = 'dq10:import-continent-maps
                            {url : 大陸ページURL}
                            {--dry-run : DBに保存しない}';

    protected $description = 'Wikiの大陸ページから maps テーブルへ街・フィールド・ダンジョンを投入する';

    public function handle(): int
    {
        $url = $this->argument('url');
        $dryRun = (bool) $this->option('dry-run');

        $this->info("fetching: {$url}");

        $html = $this->fetch($url);
        if (! $html) {
            $this->error('HTML取得失敗');
            return self::FAILURE;
        }

        [$dom, $xpath] = $this->makeDom($html);

        $continent = $this->extractContinent($xpath, $html);
        if (! $continent) {
            $this->error('continent を取得できなかった');
            return self::FAILURE;
        }

        $this->info("continent: {$continent}");

        $sectionMap = [
            '町' => '街',
            '街' => '街',
            '村' => '街',
            'フィールド' => 'フィールド',
            'ダンジョン' => 'ダンジョン',
        ];

        $rows = [];

        foreach ($sectionMap as $sectionLabel => $mapType) {
            $items = $this->extractSectionItems($xpath, $sectionLabel);

            $this->line("section [{$sectionLabel}] => ".count($items).'件');

            foreach ($items as $name) {
                $rows[] = [
                    'continent' => $continent,
                    'name' => $name,
                    'map_type' => $mapType,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        $rows = collect($rows)
            ->filter(fn ($row) => !empty($row['name']))
            ->unique(fn ($row) => $row['continent'].'|'.$row['name'].'|'.$row['map_type'])
            ->values()
            ->all();

        if (count($rows) === 0) {
            $this->warn('抽出結果 0 件');
            return self::SUCCESS;
        }

        $this->info('total: '.count($rows));

        foreach ($rows as $row) {
            $this->line("{$row['map_type']} | {$row['name']}");
        }

        if ($dryRun) {
            $this->warn('dry-run のため保存しない');
            return self::SUCCESS;
        }

        foreach ($rows as $row) {
            DB::table('maps')->updateOrInsert(
                [
                    'continent' => $row['continent'],
                    'name' => $row['name'],
                ],
                [
                    'map_type' => $row['map_type'],
                    'updated_at' => now(),
                    'created_at' => DB::raw('COALESCE(created_at, NOW())'),
                ]
            );
        }

        $this->info('maps 保存完了');
        return self::SUCCESS;
    }

    private function fetch(string $url): ?string
    {
        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0',
                ])
                ->get($url);

            if (! $response->successful()) {
                $this->error('HTTP status: '.$response->status());
                return null;
            }

            return $response->body();
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return null;
        }
    }

    private function makeDom(string $html): array
    {
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();

        // 保存HTMLでも文字化けしにくくする
        $wrapped = '<?xml encoding="UTF-8">' . $html;
        $dom->loadHTML($wrapped, LIBXML_NOERROR | LIBXML_NOWARNING);

        libxml_clear_errors();

        $xpath = new DOMXPath($dom);

        return [$dom, $xpath];
    }

    private function extractContinent(DOMXPath $xpath, string $html): ?string
    {
        // 1. og:title
        $node = $xpath->query('//meta[@property="og:title"]')->item(0);
        if ($node instanceof DOMElement) {
            $content = trim($node->getAttribute('content'));
            $title = $this->extractBracketName($content);
            if ($title) {
                return $title;
            }
        }

        // 2. title
        $node = $xpath->query('//title')->item(0);
        if ($node) {
            $title = $this->extractBracketName(trim($node->textContent));
            if ($title) {
                return $title;
            }
        }

        // 3. fallback
        if (preg_match('/[【\[]([^】\]]+)[】\]]/u', $html, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    private function extractSectionItems(DOMXPath $xpath, string $sectionLabel): array
    {
        $results = [];

        // h3 の見出し文字列に sectionLabel を含むものを探す
        $h3Nodes = $xpath->query('//h3');

        foreach ($h3Nodes as $h3) {
            $headingText = $this->normalizeText($h3->textContent);

            if (! str_starts_with($headingText, $sectionLabel)) {
                continue;
            }

            $ul = $this->findNextSiblingUl($h3);
            if (! $ul) {
                continue;
            }

            foreach ($ul->getElementsByTagName('li') as $li) {
                $name = $this->extractFirstWikiLinkNameFromLi($xpath, $li);

                if ($name) {
                    $results[] = $name;
                }
            }

            // 同名の見出しを複数拾う必要は基本ない
            break;
        }

        return array_values(array_unique($results));
    }

    private function findNextSiblingUl($node): ?DOMElement
    {
        $current = $node->nextSibling;

        while ($current) {
            if ($current instanceof DOMElement) {
                if (strtolower($current->tagName) === 'ul') {
                    return $current;
                }

                // 次が別見出しなら打ち切り
                if (in_array(strtolower($current->tagName), ['h2', 'h3'])) {
                    return null;
                }
            }

            $current = $current->nextSibling;
        }

        return null;
    }

    private function extractFirstWikiLinkNameFromLi(DOMXPath $xpath, DOMElement $li): ?string
    {
        // li 内の rel-wiki-page の最初の a だけ使う
        $aNode = $xpath->query('.//a[contains(@class, "rel-wiki-page")][1]', $li)->item(0);

        if (! $aNode) {
            return null;
        }

        $text = trim($aNode->textContent);

        return $this->extractBracketName($text);
    }

    private function extractBracketName(string $text): ?string
    {
        $text = trim($text);

        if (preg_match('/[【〖\[]\s*([^】〗\]]+?)\s*[】〗\]]/u', $text, $m)) {
            return trim($m[1]);
        }

        return $text !== '' ? $text : null;
    }

    private function normalizeText(string $text): string
    {
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim($text);
    }
}
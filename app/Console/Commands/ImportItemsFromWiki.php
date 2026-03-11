<?php

namespace App\Console\Commands;

use App\Models\Item;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ImportItemsFromWiki extends Command
{
    protected $signature = 'dq10:import-items-from-wiki
                            {--fresh : 既存itemsを削除してから取り込む}
                            {--debug : 抽出結果を表示する}';

    protected $description = 'DQ10辞典の消費アイテム・素材をitemsテーブルへ取り込む';

    public function handle(): int
    {
        if ($this->option('fresh')) {
            Item::truncate();
            $this->warn('items テーブルを空にしてIDもリセットした');
        }

        $targets = [
            [
                'url' => 'https://wikiwiki.jp/dq10dic2nd/%E9%81%93%E5%85%B7/%E6%B6%88%E8%B2%BB%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0',
                'category' => 'consumable',
            ],
            [
                'url' => 'https://wikiwiki.jp/dq10dic2nd/%E9%81%93%E5%85%B7/%E7%B4%A0%E6%9D%90%E3%83%BB%E6%9C%AA%E9%91%91%E5%AE%9A%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0',
                'category' => 'material',
            ],
            [
                'url' => 'https://wikiwiki.jp/dq10dic2nd/%E9%81%93%E5%85%B7/%E3%83%AC%E3%82%B7%E3%83%94%E5%B8%B3',
                'category' => 'recipe',
            ],
            [
                'url' => 'https://wikiwiki.jp/dq10dic2nd/%E9%81%93%E5%85%B7/%E3%82%B9%E3%82%AB%E3%82%A6%E3%83%88%E3%81%AE%E6%9B%B8',
                'category' => 'scout',
            ],
        ];

        foreach ($targets as $target) {
            $this->newLine();
            $this->info("取得中: {$target['category']}");

            $response = Http::timeout(30)
                ->retry(2, 1000)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0',
                    'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                    'Referer' => 'https://wikiwiki.jp/',
                ])
                ->get($target['url']);

            if (! $response->successful()) {
                $this->error("取得失敗: {$response->status()}");
                continue;
            }

            $names = $this->extractItemNames($response->body());

            $this->info('抽出件数: ' . count($names));

            if ($this->option('debug')) {
                foreach (array_slice($names, 0, 30) as $name) {
                    $this->line(' - ' . $name);
                }
            }

            $saved = 0;

            foreach ($names as $name) {
                Item::updateOrCreate(
                    ['name' => $name],
                    ['category' => $target['category']]
                );
                $saved++;
            }

            $this->info("保存件数: {$saved}");
        }

        $this->info('完了');

        return self::SUCCESS;
    }

    private function extractItemNames(string $html): array
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();
        @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);

        $xpath = new \DOMXPath($dom);

        // 本文エリア内の wiki ページリンクを全部見る
        $nodes = $xpath->query('//div[@id="content"]//a[contains(@class, "rel-wiki-page")]');

        $names = [];

        foreach ($nodes as $node) {
            $text = trim($node->textContent ?? '');
            $href = trim($node->getAttribute('href') ?? '');

            if ($text === '' || $text === '?') {
                continue;
            }

            if (str_contains($href, 'cmd=edit')) {
                continue;
            }

            // 【名前】 だけ通す
            if (! preg_match('/^【(.+)】$/u', $text, $m)) {
                continue;
            }

            $name = trim($m[1]);

            // ノイズ除外
            if (in_array($name, [
                '目覚めし冒険者の広場',
                'DQXショップ',
                '旅人バザー',
                '公式ガイドブック',
                'Vジャンプ',
            ], true)) {
                continue;
            }

            $names[] = $name;
        }

        return collect($names)
            ->map(fn ($name) => preg_replace('/\s+/u', ' ', $name))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
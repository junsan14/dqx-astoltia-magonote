<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ImportItemsByCategoryFromWiki extends Command
{
    protected $signature = 'dq10:import-items-by-category';

    protected $description = 'Import item names by category from wikiwiki edit source';

    private array $sources = [
        [
            'page' => '道具/消費アイテム',
            'category' => '消費アイテム',
        ],
        [
            'page' => '道具/素材・未鑑定アイテム',
            'category' => '素材',
        ],
    ];

    public function handle(): int
    {
        foreach ($this->sources as $source) {
            $this->importFromEditPage($source['page'], $source['category']);
        }

        $this->info('done');

        return self::SUCCESS;
    }

    private function importFromEditPage(string $pageName, string $category): void
    {
        $this->info("fetching: {$category}");

        $html = $this->fetchEditHtml($pageName);

        if (!$html) {
            $this->error("failed to fetch edit page: {$pageName}");
            return;
        }

        file_put_contents(
            storage_path('app/' . $this->debugHtmlFileName($category)),
            $html
        );

        $sourceText = $this->extractTextareaContent($html);

        if ($sourceText === null || trim($sourceText) === '') {
            $this->error("failed to extract textarea content: {$pageName}");
            return;
        }

        file_put_contents(
            storage_path('app/' . $this->debugTextFileName($category)),
            $sourceText
        );

        $names = $this->extractItemNamesFromWikiText($sourceText);

        $this->info("found " . count($names) . " names for {$category}");

        foreach ($names as $name) {
            DB::table('items')->updateOrInsert(
                ['name' => $name],
                [
                    'category' => $category,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        $this->info("imported: {$category}");
    }

    private function fetchEditHtml(string $pageName): ?string
    {
        try {
            $url = 'https://wikiwiki.jp/dq10dic2nd/::cmd/edit?page=' . rawurlencode($pageName);

            $response = Http::timeout(30)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cache-Control' => 'no-cache',
                    'Pragma' => 'no-cache',
                    'Referer' => 'https://wikiwiki.jp/dq10dic2nd/',
                ])
                ->withOptions([
                    'verify' => false,
                    'decode_content' => true,
                    'allow_redirects' => true,
                ])
                ->get($url);

            if (!$response->successful()) {
                $this->error('http status: ' . $response->status());
                return null;
            }

            $html = $response->body();

            if (trim($html) === '') {
                return null;
            }

            $encoding = mb_detect_encoding(
                $html,
                ['UTF-8', 'SJIS-win', 'SJIS', 'EUC-JP', 'ISO-2022-JP', 'ASCII'],
                true
            );

            if ($encoding && strtoupper($encoding) !== 'UTF-8') {
                $html = mb_convert_encoding($html, 'UTF-8', $encoding);
            }

            return $html;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return null;
        }
    }

    private function extractTextareaContent(string $html): ?string
    {
        libxml_use_internal_errors(true);

        $dom = new \DOMDocument();

        if (!@$dom->loadHTML('<?xml encoding="UTF-8">' . $html)) {
            return null;
        }

        $xpath = new \DOMXPath($dom);

        $queries = [
            '//textarea[@name="msg"]',
            '//textarea[@id="msg"]',
            '//textarea',
        ];

        foreach ($queries as $query) {
            $nodes = $xpath->query($query);

            if ($nodes && $nodes->length > 0) {
                $text = $nodes->item(0)->textContent ?? '';

                $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                $text = str_replace("\r\n", "\n", $text);
                $text = str_replace("\r", "\n", $text);

                return trim($text);
            }
        }

        return null;
    }

    private function extractItemNamesFromWikiText(string $text): array
    {
        $names = [];

        // [[〖アイテム名〗]]
        preg_match_all('/\[\[\s*〖([^〗]+)〗\s*(?:>|#|\]|$)/u', $text, $m1);
        if (!empty($m1[1])) {
            $names = array_merge($names, $m1[1]);
        }

        // 単純に 〖アイテム名〗
        preg_match_all('/〖([^〗]+)〗/u', $text, $m2);
        if (!empty($m2[1])) {
            $names = array_merge($names, $m2[1]);
        }

        $names = array_map(function ($name) {
            $name = html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $name = preg_replace('/\s+/u', ' ', $name);
            return trim($name);
        }, $names);

        $names = array_values(array_unique(array_filter($names, function ($name) {
            return $this->isValidItemName($name);
        })));

        sort($names);

        return $names;
    }

    private function isValidItemName(string $name): bool
    {
        if ($name === '') {
            return false;
        }

        $skipExact = [
            'ホーム',
            '新規',
            '編集',
            '添付',
            '一覧',
            '最終更新',
            '差分',
            'バックアップ',
            'ヘルプ',
            'Menu',
            '道具',
            '料理',
            '素材',
            '消費アイテム',
            'Edit',
        ];

        if (in_array($name, $skipExact, true)) {
            return false;
        }

        if (mb_strlen($name) > 100) {
            return false;
        }

        if (str_contains($name, 'http')) {
            return false;
        }

        return true;
    }

    private function debugHtmlFileName(string $category): string
    {
        return match ($category) {
            '消費アイテム' => 'debug_edit_consumable.html',
            '素材' => 'debug_edit_material.html',
            default => 'debug_edit.html',
        };
    }

    private function debugTextFileName(string $category): string
    {
        return match ($category) {
            '消費アイテム' => 'debug_edit_consumable.txt',
            '素材' => 'debug_edit_material.txt',
            default => 'debug_edit.txt',
        };
    }
}

<?php

namespace App\Console\Commands;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ImportMapMonsterSpawns extends Command
{
    protected $signature = 'maps:import-monster-spawns
        {--url=https://dq10.i-k-e.net/map/ : Base map index url}
        {--only= : Comma separated map names to import. Example: 煉獄の谷,アペカの村}
        {--dry-run : Parse only, do not write DB}
        {--sleep=150 : Milliseconds to sleep between requests}';

    protected $description = 'Import monster spawn data from dq10.i-k-e.net map detail pages into monster_map_spawns';

    public function handle(): int
    {
        libxml_use_internal_errors(true);

        $indexUrl = rtrim((string) $this->option('url'), '/').'/';
        $onlyMapNames = collect(explode(',', (string) $this->option('only')))
            ->map(fn ($v) => trim($v))
            ->filter()
            ->values();

        $dryRun = (bool) $this->option('dry-run');
        $sleepMs = (int) $this->option('sleep');

        $this->line("Index URL: {$indexUrl}");
        if ($onlyMapNames->isNotEmpty()) {
            $this->line('Only: '.$onlyMapNames->implode(', '));
        }
        if ($dryRun) {
            $this->warn('DRY RUN mode');
        }

        $indexHtml = $this->fetchHtml($indexUrl);
        if ($indexHtml === null) {
            $this->error('Failed to fetch map index.');
            return self::FAILURE;
        }

        $detailUrls = $this->extractMapDetailUrls($indexHtml, $indexUrl);

        if ($detailUrls->isEmpty()) {
            $this->error('No detail urls found.');
            return self::FAILURE;
        }

        $this->info('Found detail urls: '.$detailUrls->count());

        $processed = 0;
        $created = 0;
        $updated = 0;
        $skipped = 0;

        foreach ($detailUrls as $detailUrl) {
            usleep(max(0, $sleepMs) * 1000);

            $html = $this->fetchHtml($detailUrl);
            if ($html === null) {
                $this->warn("Skip: fetch failed {$detailUrl}");
                $skipped++;
                continue;
            }

            $parsed = $this->parseMapDetailPage($html);
            if ($parsed === null) {
                $this->warn("Skip: not a target map detail page {$detailUrl}");
                $skipped++;
                continue;
            }

            $mapName = $parsed['map_name'];

            if ($onlyMapNames->isNotEmpty() && ! $onlyMapNames->contains($mapName)) {
                continue;
            }

            $this->newLine();
            $this->info("=== {$mapName} ===");
            $this->line("URL: {$detailUrl}");

            $map = DB::table('maps')
                ->select('id', 'name')
                ->where('name', $mapName)
                ->first();

            if (! $map) {
                $this->warn("[MAP] not found in maps table: {$mapName}");
                $skipped++;
                continue;
            }

            $layers = DB::table('map_layers')
                ->select('id', 'map_id', 'layer_name')
                ->where('map_id', $map->id)
                ->get();

            if ($layers->isEmpty()) {
                $this->warn("[LAYER] map_layers not found for map_id={$map->id} name={$mapName}");
            }

            foreach ($parsed['sections'] as $section) {
                $processed++;

                $h2Text = $section['heading'];
                $layerSuffix = $section['layer_suffix'];

                $layer = $this->resolveLayer($layers, $layerSuffix, $h2Text);

                if (! $layer) {
                    $this->warn("[LAYER] unresolved heading={$h2Text} suffix={$layerSuffix}");
                    continue;
                }

                $this->line(sprintf(
                    '[LAYER] resolved map_layer_id=%d layer_name=%s',
                    $layer->id,
                    $layer->layer_name ?? '(null)'
                ));

                foreach ($section['monsters'] as $spawn) {
                    $monsterName = $spawn['monster_name'];

                    $monster = DB::table('monsters')
                        ->select('id', 'name')
                        ->where('name', $monsterName)
                        ->first();

                    if (! $monster) {
                        $this->warn("[MONSTER] not found: {$monsterName}");
                        continue;
                    }

                    [$spawnArea, $spawnNote] = $this->splitSpawnText($spawn['spawn_text']);

                    $existing = DB::table('monster_map_spawns')
                        ->where('monster_id', $monster->id)
                        ->where('map_id', $map->id)
                        ->where('map_layer_id', $layer->id)
                        ->first();

                    $mergedArea = $this->mergeTextValues(
                        $existing->area ?? null,
                        $spawnArea
                    );

                    $mergedNote = $this->mergeTextValues(
                        $existing->note ?? null,
                        $spawnNote
                    );

                    $payload = [
                        'monster_id'   => $monster->id,
                        'map_id'       => $map->id,
                        'map_layer_id' => $layer->id,
                        'area'         => $mergedArea,
                        'spawn_time'   => 'normal',
                        'note'         => $mergedNote,
                        'updated_at'   => now(),
                    ];

                    if ($existing) {
                        $this->line(sprintf(
                            '[UPDATE] monster=%s monster_id=%d map_id=%d layer_id=%d area="%s" note="%s"',
                            $monster->name,
                            $monster->id,
                            $map->id,
                            $layer->id,
                            $mergedArea ?? '',
                            $mergedNote ?? ''
                        ));

                        if (! $dryRun) {
                            DB::table('monster_map_spawns')
                                ->where('id', $existing->id)
                                ->update($payload);
                        }

                        $updated++;
                    } else {
                        $payload['created_at'] = now();

                        $this->line(sprintf(
                            '[CREATE] monster=%s monster_id=%d map_id=%d layer_id=%d area="%s" note="%s"',
                            $monster->name,
                            $monster->id,
                            $map->id,
                            $layer->id,
                            $mergedArea ?? '',
                            $mergedNote ?? ''
                        ));

                        if (! $dryRun) {
                            DB::table('monster_map_spawns')->insert($payload);
                        }

                        $created++;
                    }
                }
            }
        }

        $this->newLine();
        $this->info("done processed={$processed} created={$created} updated={$updated} skipped={$skipped}");

        return self::SUCCESS;
    }

    private function fetchHtml(string $url): ?string
    {
        try {
            $response = Http::timeout(20)
                ->retry(2, 500)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; Laravel ImportMapMonsterSpawns/1.0)',
                    'Accept-Language' => 'ja,en;q=0.9',
                ])
                ->get($url);

            if (! $response->successful()) {
                $this->warn("HTTP {$response->status()} {$url}");
                return null;
            }

            return $response->body();
        } catch (\Throwable $e) {
            $this->warn("HTTP error {$url} : {$e->getMessage()}");
            return null;
        }
    }

    private function extractMapDetailUrls(string $html, string $baseUrl)
    {
        $xpath = $this->makeXPath($html);

        $urls = collect();

        /** @var DOMElement $a */
        foreach ($xpath->query('//a[@href]') as $a) {
            $href = trim((string) $a->getAttribute('href'));
            if ($href === '') {
                continue;
            }

            if (! Str::startsWith($href, '/map/')) {
                continue;
            }

            if ($href === '/map/' || $href === '/map') {
                continue;
            }

            $absolute = $this->toAbsoluteUrl($href, $baseUrl);

            $path = parse_url($absolute, PHP_URL_PATH) ?? '';
            if (! preg_match('#^/map/[^/]+$#u', $path)) {
                continue;
            }

            $urls->push($absolute);
        }

        return $urls->unique()->values();
    }

    private function parseMapDetailPage(string $html): ?array
    {
        $xpath = $this->makeXPath($html);

        $h1 = trim($xpath->evaluate('string(//h1[1])'));
        if ($h1 === '') {
            return null;
        }

        $h2Nodes = $xpath->query('//h2');
        if (! $h2Nodes || $h2Nodes->length === 0) {
            return null;
        }

        $sections = [];

        /** @var DOMElement $h2 */
        foreach ($h2Nodes as $h2) {
            $heading = $this->normalizeSpaces(trim($h2->textContent));
            if ($heading === '') {
                continue;
            }

            $monsterCards = $this->extractMonsterCardsUnderHeading($h2, $xpath);
            if (empty($monsterCards)) {
                continue;
            }

            $sections[] = [
                'heading' => $heading,
                'layer_suffix' => $this->extractLayerSuffix($h1, $heading),
                'monsters' => $monsterCards,
            ];
        }

        if (empty($sections)) {
            return null;
        }

        return [
            'map_name' => $h1,
            'sections' => $sections,
        ];
    }

    private function extractMonsterCardsUnderHeading(DOMElement $h2, DOMXPath $xpath): array
    {
        $monsters = [];
        $node = $h2->nextSibling;

        while ($node) {
            if ($node instanceof DOMElement && in_array(strtolower($node->tagName), ['h1', 'h2'], true)) {
                break;
            }

            if ($node instanceof DOMElement && strtolower($node->tagName) === 'ul') {
                $class = (string) $node->getAttribute('class');

                if (Str::contains($class, 'RpCardList')) {
                    foreach ($xpath->query('.//li[contains(@class, "RpCard")]', $node) as $li) {
                        $name = $this->normalizeSpaces(trim($xpath->evaluate('string(.//*[contains(@class,"RpCard_TitleName")]//a[1])', $li)));
                        $spawnText = $this->normalizeSpaces(trim($xpath->evaluate(
                            'string(.//div[contains(@class,"RpCard_Property")][.//div[contains(@class,"RpCard_Property_Header")][normalize-space()="出現"]]//div[contains(@class,"RpCard_Property_Value")][1])',
                            $li
                        )));

                        if ($name === '') {
                            continue;
                        }

                        $monsters[] = [
                            'monster_name' => $name,
                            'spawn_text' => $spawnText,
                        ];
                    }

                    if (! empty($monsters)) {
                        break;
                    }
                }
            }

            $node = $node->nextSibling;
        }

        return $monsters;
    }

    private function resolveLayer($layers, ?string $layerSuffix, string $heading)
    {
        if ($layers->isEmpty()) {
            return null;
        }

        if ($layerSuffix !== null && $layerSuffix !== '') {
            $exact = $layers->first(function ($layer) use ($layerSuffix) {
                return $this->normalizeLayerName($layer->layer_name) === $this->normalizeLayerName($layerSuffix);
            });

            if ($exact) {
                return $exact;
            }
        }

        $normalizedHeading = $this->normalizeLayerName($heading);

        $contains = $layers->first(function ($layer) use ($normalizedHeading) {
            $layerName = $this->normalizeLayerName($layer->layer_name);
            return $layerName !== '' && Str::contains($normalizedHeading, $layerName);
        });

        if ($contains) {
            return $contains;
        }

        if ($layers->count() === 1) {
            return $layers->first();
        }

        return null;
    }

    private function extractLayerSuffix(string $mapName, string $heading): ?string
    {
        $heading = $this->normalizeSpaces($heading);
        $mapName = $this->normalizeSpaces($mapName);

        if ($heading === $mapName) {
            return '地上';
        }

        if (Str::startsWith($heading, $mapName.'_')) {
            return trim(Str::after($heading, $mapName.'_'));
        }

        if (Str::startsWith($heading, $mapName.' ')) {
            return trim(Str::after($heading, $mapName.' '));
        }

        if (preg_match('/^'.preg_quote($mapName, '/').'[_\s・\-]*(.+)$/u', $heading, $m)) {
            return trim($m[1]);
        }

        return trim($heading);
    }

    private function splitSpawnText(?string $spawnText): array
    {
        $spawnText = $this->normalizeSpaces((string) $spawnText);

        if ($spawnText === '') {
            return [null, null];
        }

        if (Str::contains($spawnText, '@')) {
            [$note, $area] = array_pad(explode('@', $spawnText, 2), 2, null);

            return [
                $this->nullable(trim((string) $area)),
                $this->nullable(trim((string) $note)),
            ];
        }

        return [null, $spawnText];
    }

    private function mergeTextValues(?string ...$values): ?string
    {
        $items = collect($values)
            ->filter(fn ($v) => $v !== null && trim((string) $v) !== '')
            ->flatMap(function ($value) {
                return preg_split('/\r\n|\r|\n/u', (string) $value) ?: [];
            })
            ->map(fn ($v) => trim((string) $v))
            ->filter()
            ->unique()
            ->values();

        return $items->isEmpty() ? null : $items->implode("\n");
    }

    private function normalizeLayerName(?string $value): string
    {
        $value = $this->normalizeSpaces((string) $value);
        $value = str_replace(['階', '　'], ['', ''], $value);

        $map = [
            '地下1' => '地下1階',
            '地下2' => '地下2階',
            '地下3' => '地下3階',
            '地下4' => '地下4階',
            '地下5' => '地下5階',
            '1' => '1階',
            '2' => '2階',
            '3' => '3階',
            '4' => '4階',
            '5' => '5階',
            '6' => '6階',
            '7' => '7階',
            '8' => '8階',
            '9' => '9階',
        ];

        return $map[$value] ?? $value;
    }

    private function normalizeSpaces(string $value): string
    {
        $value = str_replace("\xc2\xa0", ' ', $value);
        $value = preg_replace('/[ \t\x{3000}]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        return trim($value);
    }

    private function nullable(?string $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private function makeXPath(string $html): DOMXPath
    {
        $dom = new DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        return new DOMXPath($dom);
    }

    private function toAbsoluteUrl(string $href, string $baseUrl): string
    {
        if (Str::startsWith($href, ['http://', 'https://'])) {
            return $href;
        }

        $parts = parse_url($baseUrl);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        if (Str::startsWith($href, '/')) {
            return "{$scheme}://{$host}{$port}{$href}";
        }

        return rtrim($baseUrl, '/').'/'.$href;
    }
}
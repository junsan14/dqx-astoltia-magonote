<?php

namespace App\Services;

use App\Models\Equipment;
use Closure;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class EquipmentFabricTypeScraper
{
    public const SOURCE_ORIGIN = 'https://xn--10-yg4a1a3kyh.jp';

    public const SEWING_LIST_URL =
        self::SOURCE_ORIGIN . '/a_bgset/dq10_bgset_lsb_05.html';

    /**
     * 裁縫装備一覧 → セットページ → 部位ページの順に巡回する。
     *
     * DB内のsource_url/detail_urlは取得元として一切使用しない。
     * DBは装備名による照合とfabric_type更新のためだけに使用する。
     *
     * @return array<int, array<string, mixed>>
     */
    public function scanFromSewingList(
        int $delayMs = 300,
        ?int $limit = null,
        ?string $fromSetName = null,
        ?Closure $progress = null
    ): array {
        $progress ??= static function (): void {
        };

        $progress('裁縫装備一覧を取得しています...');
        $listHtml = $this->fetch(self::SEWING_LIST_URL);
        $setLinks = $this->extractSetLinks($listHtml);

        if ($setLinks === []) {
            throw new RuntimeException(
                '裁縫装備のセットURLを取得できませんでした。取得元: '
                . self::SEWING_LIST_URL
            );
        }

        if (filled($fromSetName)) {
            $setLinks = $this->sliceSetLinksFrom(
                setLinks: $setLinks,
                requestedSetName: (string) $fromSetName
            );

            $firstSetName = reset($setLinks);
            $progress('開始セット: ' . ($firstSetName ?: $fromSetName));
        }

        $progress(sprintf('処理対象のセットページは %d 件です。', count($setLinks)));

        $equipmentByName = $this->buildEquipmentNameIndex();
        $visitedDetailUrls = [];
        $results = [];

        $setPosition = 0;

        foreach ($setLinks as $setUrl => $setName) {
            $setPosition++;

            $progress(sprintf(
                '[セット %d/%d] %s',
                $setPosition,
                count($setLinks),
                $setName
            ));

            try {
                $setHtml = $this->fetch($setUrl);
                $detailLinks = $this->extractDetailLinks($setHtml);

                $progress(sprintf('  部位リンクを %d 件検出', count($detailLinks)));

                foreach ($detailLinks as $detailUrl => $itemName) {
                    if (isset($visitedDetailUrls[$detailUrl])) {
                        continue;
                    }

                    $visitedDetailUrls[$detailUrl] = true;

                    try {
                        $results[] = $this->inspectDetailUrlWithIndex(
                            detailUrl: $detailUrl,
                            itemName: $itemName,
                            equipmentByName: $equipmentByName,
                            setName: $setName,
                            setUrl: $setUrl
                        );
                    } catch (Throwable $e) {
                        $results[] = $this->makeErrorResult(
                            itemName: $itemName,
                            detailUrl: $detailUrl,
                            status: 'detail_fetch_error',
                            message: $e->getMessage(),
                            setName: $setName,
                            setUrl: $setUrl
                        );
                    }

                    $progress(sprintf(
                        '  [部位 %d%s] %s',
                        count($results),
                        $limit !== null ? '/' . $limit : '',
                        $itemName
                    ));

                    if ($limit !== null && count($results) >= $limit) {
                        return $results;
                    }

                    $this->sleep($delayMs);
                }
            } catch (Throwable $e) {
                $results[] = $this->makeErrorResult(
                    itemName: null,
                    detailUrl: null,
                    status: 'set_fetch_error',
                    message: $e->getMessage(),
                    setName: $setName,
                    setUrl: $setUrl
                );
            }

            $this->sleep($delayMs);
        }

        return $results;
    }

    /**
     * 裁縫装備一覧から指定セットだけを探し、セット内の全部位を確認する。
     *
     * セット名は「フォーチュンローブ」「フォーチュンローブセット」の
     * どちらでも指定できる。
     *
     * equipments.detail_url/source_urlは使用しない。
     *
     * @return array<int, array<string, mixed>>
     */
    public function inspectSetFromSewingList(
        string $requestedSetName,
        int $delayMs = 300,
        ?Closure $progress = null
    ): array {
        $progress ??= static function (): void {
        };

        $requestedSetName = $this->normalizeText($requestedSetName);

        if ($requestedSetName === '') {
            throw new RuntimeException('セット名を指定してください。');
        }

        $progress('裁縫装備一覧からセットページを探しています...');

        $listHtml = $this->fetch(self::SEWING_LIST_URL);
        $setLinks = $this->extractSetLinks($listHtml);

        if ($setLinks === []) {
            throw new RuntimeException(
                '裁縫装備のセットURLを取得できませんでした。取得元: '
                . self::SEWING_LIST_URL
            );
        }

        $matchedSet = $this->findSetLink(
            setLinks: $setLinks,
            requestedSetName: $requestedSetName
        );

        if ($matchedSet === null) {
            throw new RuntimeException(
                "裁縫装備一覧にセットが見つかりません: {$requestedSetName}"
            );
        }

        $setUrl = $matchedSet['url'];
        $setName = $matchedSet['name'];

        $progress("セットを検出しました: {$setName}");
        $progress("セットURL: {$setUrl}");

        $setHtml = $this->fetch($setUrl);
        $detailLinks = $this->extractDetailLinks($setHtml);

        if ($detailLinks === []) {
            throw new RuntimeException(
                "セットページに部位リンクが見つかりません: {$setName}"
            );
        }

        $progress(sprintf('部位リンクを %d 件検出しました。', count($detailLinks)));

        $equipmentByName = $this->buildEquipmentNameIndex();
        $results = [];
        $position = 0;

        foreach ($detailLinks as $detailUrl => $itemName) {
            $position++;

            $progress(sprintf(
                '[部位 %d/%d] %s',
                $position,
                count($detailLinks),
                $itemName
            ));

            try {
                $results[] = $this->inspectDetailUrlWithIndex(
                    detailUrl: $detailUrl,
                    itemName: $itemName,
                    equipmentByName: $equipmentByName,
                    setName: $setName,
                    setUrl: $setUrl
                );
            } catch (Throwable $e) {
                $results[] = $this->makeErrorResult(
                    itemName: $itemName,
                    detailUrl: $detailUrl,
                    status: 'detail_fetch_error',
                    message: $e->getMessage(),
                    setName: $setName,
                    setUrl: $setUrl
                );
            }

            $this->sleep($delayMs);
        }

        return $results;
    }

    /**
     * 一覧サイト内から装備名を探して1件だけ確認する。
     *
     * equipments.detail_url/source_urlは使用しない。
     * group_nameが入っていれば、該当セットを優先して探す。
     *
     * @return array<string, mixed>
     */
    public function inspectItemFromSewingList(
        string $itemName,
        int $delayMs = 300,
        ?Closure $progress = null
    ): array {
        $progress ??= static function (): void {
        };

        $targetName = $this->normalizeText($itemName);

        /** @var Equipment|null $equipment */
        $equipment = Equipment::query()
            ->select(['id', 'item_name', 'group_name', 'fabric_type'])
            ->where('item_name', $targetName)
            ->first();

        if ($equipment === null) {
            throw new RuntimeException("DBに装備が見つかりません: {$targetName}");
        }

        $progress('裁縫装備一覧からセットページを探しています...');

        $listHtml = $this->fetch(self::SEWING_LIST_URL);
        $setLinks = $this->extractSetLinks($listHtml);

        if ($setLinks === []) {
            throw new RuntimeException(
                '裁縫装備のセットURLを取得できませんでした。取得元: '
                . self::SEWING_LIST_URL
            );
        }

        $setLinks = $this->prioritizeSetLinks(
            setLinks: $setLinks,
            itemName: $targetName,
            groupName: $this->normalizeText((string) $equipment->group_name)
        );

        foreach ($setLinks as $setUrl => $setName) {
            $progress("確認中: {$setName}");

            $setHtml = $this->fetch($setUrl);
            $detailLinks = $this->extractDetailLinks($setHtml);

            foreach ($detailLinks as $detailUrl => $linkedItemName) {
                if ($this->normalizeText($linkedItemName) !== $targetName) {
                    continue;
                }

                return $this->inspectDetailUrlWithEquipment(
                    detailUrl: $detailUrl,
                    itemName: $targetName,
                    equipment: $equipment,
                    setName: $setName,
                    setUrl: $setUrl
                );
            }

            $this->sleep($delayMs);
        }

        return [
            'equipment_id' => $equipment->id,
            'item_name' => $targetName,
            'group_name' => $equipment->group_name,
            'current_fabric_type' => $equipment->fabric_type,
            'detected_fabric_type' => null,
            'characteristic' => null,
            'status' => 'source_item_not_found',
            'source_list_url' => self::SEWING_LIST_URL,
            'set_name' => null,
            'set_url' => null,
            'detail_url' => null,
            'error' => '裁縫装備一覧のセットページ内に同名の部位リンクが見つかりませんでした。',
        ];
    }

    /**
     * 明示的に渡された部位URLを1件確認する。
     * DB保存URLは参照しない。
     *
     * @return array<string, mixed>
     */
    public function inspectDetailUrl(
        string $detailUrl,
        ?string $itemName = null
    ): array {
        $html = $this->fetch($detailUrl);

        $detectedItemName = filled($itemName)
            ? $this->normalizeText((string) $itemName)
            : $this->extractItemName($html);

        $equipment = Equipment::query()
            ->select(['id', 'item_name', 'group_name', 'fabric_type'])
            ->where('item_name', $detectedItemName)
            ->first();

        return $this->buildInspectionResult(
            html: $html,
            detailUrl: $detailUrl,
            itemName: $detectedItemName,
            equipment: $equipment,
            setName: null,
            setUrl: null
        );
    }

    /**
     * @param array<int, array<string, mixed>> $results
     */
    public function writeReport(
        array $results,
        string $prefix,
        ?string $requestedFileName = null
    ): string {
        $fileName = filled($requestedFileName)
            ? basename((string) $requestedFileName)
            : sprintf('%s-%s.log', $prefix, now()->format('Ymd-His'));

        $path = storage_path('logs/' . $fileName);

        File::ensureDirectoryExists(dirname($path));

        $lines = [
            sprintf(
                '[%s] source=%s result_count=%d',
                now()->format('Y-m-d H:i:s'),
                self::SEWING_LIST_URL,
                count($results)
            ),
        ];

        foreach ($results as $result) {
            $lines[] = json_encode(
                $result,
                JSON_UNESCAPED_UNICODE
                | JSON_UNESCAPED_SLASHES
                | JSON_INVALID_UTF8_SUBSTITUTE
            );
        }

        File::put($path, implode(PHP_EOL, $lines) . PHP_EOL);

        return $path;
    }

    /**
     * @return array<string, Equipment>
     */
    private function buildEquipmentNameIndex(): array
    {
        $index = [];

        Equipment::query()
            ->select(['id', 'item_name', 'group_name', 'fabric_type'])
            ->orderBy('id')
            ->chunkById(500, function ($equipments) use (&$index): void {
                foreach ($equipments as $equipment) {
                    $name = $this->normalizeText((string) $equipment->item_name);

                    if ($name !== '') {
                        $index[$name] ??= $equipment;
                    }
                }
            });

        return $index;
    }

    /**
     * @param array<string, Equipment> $equipmentByName
     * @return array<string, mixed>
     */
    private function inspectDetailUrlWithIndex(
        string $detailUrl,
        string $itemName,
        array $equipmentByName,
        ?string $setName,
        ?string $setUrl
    ): array {
        $html = $this->fetch($detailUrl);
        $normalizedItemName = $this->normalizeText($itemName);
        $equipment = $equipmentByName[$normalizedItemName] ?? null;

        return $this->buildInspectionResult(
            html: $html,
            detailUrl: $detailUrl,
            itemName: $normalizedItemName,
            equipment: $equipment,
            setName: $setName,
            setUrl: $setUrl
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function inspectDetailUrlWithEquipment(
        string $detailUrl,
        string $itemName,
        Equipment $equipment,
        ?string $setName,
        ?string $setUrl
    ): array {
        $html = $this->fetch($detailUrl);

        return $this->buildInspectionResult(
            html: $html,
            detailUrl: $detailUrl,
            itemName: $itemName,
            equipment: $equipment,
            setName: $setName,
            setUrl: $setUrl
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function buildInspectionResult(
        string $html,
        string $detailUrl,
        string $itemName,
        ?Equipment $equipment,
        ?string $setName,
        ?string $setUrl
    ): array {
        $characteristic = $this->extractCharacteristic($html);
        $fabricType = $this->mapFabricType($characteristic);
        $currentFabricType = $equipment?->fabric_type;

        $status = match (true) {
            $characteristic === null => 'characteristic_not_found',
            $fabricType === null => 'unknown_characteristic',
            $equipment === null => 'db_not_found',
            $currentFabricType === $fabricType => 'unchanged',
            default => 'change',
        };

        return [
            'equipment_id' => $equipment?->id,
            'item_name' => $itemName,
            'group_name' => $equipment?->group_name,
            'current_fabric_type' => $currentFabricType,
            'detected_fabric_type' => $fabricType,
            'characteristic' => $characteristic,
            'status' => $status,
            'source_list_url' => self::SEWING_LIST_URL,
            'set_name' => $setName,
            'set_url' => $setUrl,
            'detail_url' => $detailUrl,
            'error' => null,
        ];
    }

    /**
     * @return array<string, string> URL => セット名
     */
    private function extractSetLinks(string $html): array
    {
        return $this->extractSourceLinks(
            html: $html,
            directory: 'a_bgset',
            filePrefix: 'dq10_bgset_k_'
        );
    }

    /**
     * @return array<string, string> URL => 装備名
     */
    private function extractDetailLinks(string $html): array
    {
        return $this->extractSourceLinks(
            html: $html,
            directory: 'a_bogu',
            filePrefix: 'dq10_bogu_k_'
        );
    }

    /**
     * table.table1内のリンクをDOMで抽出する。
     * table1が取れなかった場合はページ内の全リンクを予備検索する。
     *
     * @return array<string, string> URL => リンク文字列
     */
    private function extractSourceLinks(
        string $html,
        string $directory,
        string $filePrefix
    ): array {
        $xpath = $this->createXPath($html);

        $query = '//table['
            . 'contains(concat(" ", normalize-space(@class), " "), " table1 ")'
            . ']//a[@href]';

        $nodes = $xpath->query($query);

        if ($nodes === false || $nodes->length === 0) {
            $nodes = $xpath->query('//a[@href]');
        }

        if ($nodes === false) {
            return [];
        }

        $links = [];

        foreach ($nodes as $node) {
            if (!$node instanceof DOMElement) {
                continue;
            }

            $url = $this->normalizeSourceHref(
                href: $node->getAttribute('href'),
                directory: $directory,
                filePrefix: $filePrefix
            );

            if ($url === null) {
                continue;
            }

            $linkText = $this->normalizeText($node->textContent);

            if ($linkText === '') {
                continue;
            }

            $links[$url] ??= $linkText;
        }

        return $links;
    }

    private function normalizeSourceHref(
        string $href,
        string $directory,
        string $filePrefix
    ): ?string {
        $href = html_entity_decode(
            trim($href),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8'
        );

        if ($href === '') {
            return null;
        }

        $path = parse_url($href, PHP_URL_PATH);

        if (!is_string($path) || $path === '') {
            return null;
        }

        // ../a_bgset/... や ../a_bogu/... を安全に処理する。
        // 正規表現は使用せず、対象ディレクトリとファイル名を確認する。
        $decodedPath = rawurldecode(str_replace('\\', '/', $path));
        $normalizedPath = '/' . ltrim($decodedPath, '/');
        $directoryPart = '/' . trim($directory, '/') . '/';

        if (!str_contains($normalizedPath, $directoryPart)) {
            return null;
        }

        $fileName = basename($decodedPath);

        if (
            !str_starts_with($fileName, $filePrefix)
            || !str_ends_with(strtolower($fileName), '.html')
        ) {
            return null;
        }

        return self::SOURCE_ORIGIN
            . '/'
            . trim($directory, '/')
            . '/'
            . $fileName;
    }

    /**
     * 指定セットを含め、それ以降のセットだけを返す。
     * 「セット」の有無は吸収する。
     *
     * @param array<string, string> $setLinks
     * @return array<string, string>
     */
    private function sliceSetLinksFrom(
        array $setLinks,
        string $requestedSetName
    ): array {
        $target = $this->normalizeSetNameForComparison($requestedSetName);
        $started = false;
        $sliced = [];

        foreach ($setLinks as $url => $setName) {
            if (
                !$started
                && $this->normalizeSetNameForComparison($setName) === $target
            ) {
                $started = true;
            }

            if ($started) {
                $sliced[$url] = $setName;
            }
        }

        if (!$started) {
            throw new RuntimeException(
                "開始セットが裁縫装備一覧に見つかりません: {$requestedSetName}"
            );
        }

        return $sliced;
    }

    /**
     * 指定されたセット名に一致するURLを返す。
     * 「セット」の有無と全角・半角空白の違いを吸収する。
     *
     * @param array<string, string> $setLinks
     * @return array{url: string, name: string}|null
     */
    private function findSetLink(
        array $setLinks,
        string $requestedSetName
    ): ?array {
        $target = $this->normalizeSetNameForComparison($requestedSetName);

        foreach ($setLinks as $url => $setName) {
            if ($this->normalizeSetNameForComparison($setName) === $target) {
                return [
                    'url' => $url,
                    'name' => $setName,
                ];
            }
        }

        return null;
    }

    private function normalizeSetNameForComparison(string $setName): string
    {
        $setName = $this->normalizeText($setName);
        $setName = preg_replace('/セット$/u', '', $setName) ?? $setName;

        return $this->normalizeText($setName);
    }

    /**
     * group_nameや「装備名 + セット」に一致するセットを先に確認する。
     *
     * @param array<string, string> $setLinks
     * @return array<string, string>
     */
    private function prioritizeSetLinks(
        array $setLinks,
        string $itemName,
        string $groupName
    ): array {
        $preferred = [];
        $others = [];
        $possibleSetNames = array_values(array_filter([
            $groupName,
            $itemName . 'セット',
        ]));

        foreach ($setLinks as $url => $setName) {
            $normalizedSetName = $this->normalizeText($setName);

            if (in_array($normalizedSetName, $possibleSetNames, true)) {
                $preferred[$url] = $setName;
            } else {
                $others[$url] = $setName;
            }
        }

        return $preferred + $others;
    }

    private function extractItemName(string $html): string
    {
        $xpath = $this->createXPath($html);
        $heading = $xpath->query('//h1[1]')?->item(0);

        if (!$heading instanceof DOMNode) {
            return '';
        }

        $text = $this->normalizeText($heading->textContent);
        $name = preg_replace(
            '/の(?:詳細(?:\([^)]*\))?|防具詳細).*$/u',
            '',
            $text
        );

        return $this->normalizeText((string) $name);
    }

    private function extractCharacteristic(string $html): ?string
    {
        $xpath = $this->createXPath($html);
        $headings = $xpath->query(
            '//h3[contains(normalize-space(string(.)), "の特性")]'
        );

        if ($headings !== false) {
            foreach ($headings as $heading) {
                $sectionText = '';

                if ($heading->parentNode !== null) {
                    $sectionText = $this->normalizeText(
                        $heading->parentNode->textContent
                    );
                }

                $characteristic = $this->extractCharacteristicFromText(
                    $sectionText
                );

                if ($characteristic !== null) {
                    return $characteristic;
                }

                // 親要素の構造が変わった場合に備え、h3の後続ノードも確認する。
                $parts = [];

                for (
                    $node = $heading->nextSibling;
                    $node !== null;
                    $node = $node->nextSibling
                ) {
                    if (
                        $node instanceof DOMElement
                        && in_array(strtolower($node->tagName), ['h2', 'h3'], true)
                    ) {
                        break;
                    }

                    $parts[] = $node->textContent ?? '';
                }

                $characteristic = $this->extractCharacteristicFromText(
                    implode(' ', $parts)
                );

                if ($characteristic !== null) {
                    return $characteristic;
                }
            }
        }

        // 最終予備処理。
        return $this->extractCharacteristicFromText(
            $xpath->document->documentElement?->textContent ?? ''
        );
    }

    private function extractCharacteristicFromText(string $text): ?string
    {
        $text = $this->normalizeText($text);

        if (
            preg_match(
                '/特性\s*[：:]\s*'
                . '(集中力変化\s*[（(]\s*虹\s*[）)]'
                . '|威力会心率上昇\s*[（(]\s*光地金\s*[）)]'
                . '|布復活\s*[（(]\s*再生布\s*[）)])/u',
                $text,
                $matches
            )
        ) {
            return '特性：' . $this->normalizeText($matches[1]);
        }

        if (
            preg_match(
                '/特性\s*[：:]\s*([^\r\n]+)/u',
                $text,
                $matches
            )
        ) {
            return '特性：' . $this->normalizeText($matches[1]);
        }

        return null;
    }

    private function mapFabricType(?string $characteristic): ?string
    {
        if ($characteristic === null) {
            return null;
        }

        $text = preg_replace('/\s+/u', '', $characteristic)
            ?? $characteristic;

        if (
            str_contains($text, '集中力変化')
            && str_contains($text, '虹')
        ) {
            return '虹布';
        }

        if (
            str_contains($text, '威力会心率上昇')
            && str_contains($text, '光地金')
        ) {
            return 'ピンク布';
        }

        if (
            str_contains($text, '布復活')
            && str_contains($text, '再生布')
        ) {
            return '再生布';
        }

        return null;
    }

    private function fetch(string $url): string
    {
        $response = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (compatible; DqxFabricTypeImporter/2.0)',
            'Accept' => 'text/html,application/xhtml+xml',
            'Accept-Language' => 'ja,en;q=0.8',
        ])
            ->retry(3, 1000)
            ->connectTimeout(10)
            ->timeout(30)
            ->get($url);

        if (!$response->successful()) {
            throw new RuntimeException(sprintf(
                'HTTP %d: %s',
                $response->status(),
                $url
            ));
        }

        $html = $response->body();

        if ($html === '') {
            throw new RuntimeException('空のHTMLが返されました: ' . $url);
        }

        return $this->toUtf8(
            html: $html,
            contentType: (string) $response->header('Content-Type')
        );
    }

    private function toUtf8(string $html, string $contentType = ''): string
    {
        $encoding = null;

        if (
            preg_match(
                '/charset\s*=\s*["\']?([^;"\'\s]+)/i',
                $contentType,
                $matches
            )
        ) {
            $encoding = $matches[1];
        } elseif (
            preg_match(
                '/<meta[^>]+charset\s*=\s*["\']?([^"\'\s>]+)/i',
                $html,
                $matches
            )
        ) {
            $encoding = $matches[1];
        }

        if ($encoding !== null) {
            $normalized = strtoupper(str_replace('_', '-', $encoding));

            if (!in_array($normalized, ['UTF-8', 'UTF8'], true)) {
                return mb_convert_encoding($html, 'UTF-8', $encoding);
            }
        }

        if (mb_check_encoding($html, 'UTF-8')) {
            return $html;
        }

        $detected = mb_detect_encoding(
            $html,
            ['SJIS-win', 'EUC-JP', 'ISO-2022-JP', 'UTF-8'],
            true
        );

        if ($detected === false || strtoupper($detected) === 'UTF-8') {
            return $html;
        }

        return mb_convert_encoding($html, 'UTF-8', $detected);
    }

    private function createXPath(string $html): DOMXPath
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);

        $loaded = $dom->loadHTML(
            '<?xml encoding="UTF-8">' . $html,
            LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET
        );

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if ($loaded === false) {
            throw new RuntimeException('HTMLを解析できませんでした。');
        }

        return new DOMXPath($dom);
    }

    private function normalizeText(?string $text): string
    {
        $text = html_entity_decode(
            (string) $text,
            ENT_QUOTES | ENT_HTML5,
            'UTF-8'
        );

        return trim(
            preg_replace('/[\s\x{00A0}]+/u', ' ', $text) ?? $text
        );
    }

    private function sleep(int $delayMs): void
    {
        if ($delayMs > 0) {
            usleep($delayMs * 1000);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function makeErrorResult(
        ?string $itemName,
        ?string $detailUrl,
        string $status,
        string $message,
        ?string $setName,
        ?string $setUrl
    ): array {
        return [
            'equipment_id' => null,
            'item_name' => $itemName,
            'group_name' => null,
            'current_fabric_type' => null,
            'detected_fabric_type' => null,
            'characteristic' => null,
            'status' => $status,
            'source_list_url' => self::SEWING_LIST_URL,
            'set_name' => $setName,
            'set_url' => $setUrl,
            'detail_url' => $detailUrl,
            'error' => $message,
        ];
    }
}

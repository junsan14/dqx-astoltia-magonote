<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CraftProfitEquipmentController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = DB::table('equipments')
            ->select([
                'id',
                'item_id',
                'item_name',
                'item_kind',
                'item_type_key',
                'item_type',
                'craft_type',
                'craft_level',
                'equip_level',
                'recipe_book',
                'recipe_place',
                'description',
                'slot',
                'slot_grid_type',
                'slot_grid_cols',
                'group_kind',
                'group_id',
                'group_name',
                'items_count',
                'crystal_by_alchemy',
                'materials_json',
                'slot_grid_json',
                'jobs_json',
                'equipable_type',
                'source_url',
                'detail_url',
                'effects_json',
                'created_at',
                'updated_at',
            ])
            ->whereNotNull('item_name')
            ->where(function ($q) {
                $q->whereNotNull('craft_type')
                  ->orWhereNotNull('materials_json');
            })
            ->orderByRaw("
                CASE craft_type
                    WHEN '裁縫' THEN 1
                    WHEN '武器鍛冶' THEN 2
                    WHEN '防具鍛冶' THEN 3
                    WHEN '木工' THEN 4
                    ELSE 99
                END
            ")
            ->orderBy('equip_level')
            ->orderBy('group_name')
            ->orderBy('item_name')
            ->get();

        $itemMap = $this->buildItemMapFromEquipments($rows);

        $data = $rows->map(function ($row) use ($itemMap) {
            $row->materials_json = $this->normalizeMaterialsJson(
                $row->materials_json,
                $itemMap
            );

            $row->slot_grid_json = $this->normalizeJsonValue($row->slot_grid_json, null);
            $row->jobs_json = $this->normalizeJsonValue($row->jobs_json, []);
            $row->effects_json = $this->normalizeJsonValue($row->effects_json, []);

            return $row;
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    private function buildItemMapFromEquipments(Collection $rows): array
    {
        $itemIds = [];

        foreach ($rows as $row) {
            $materials = $this->decodeJsonArray($row->materials_json);

            foreach ($materials as $material) {
                if (!is_array($material)) {
                    continue;
                }

                $itemId = $this->extractMaterialItemId($material);

                if ($itemId !== null && $itemId !== '') {
                    $itemIds[] = (string) $itemId;
                }
            }
        }

        $itemIds = array_values(array_unique($itemIds));

        if (empty($itemIds)) {
            return [];
        }

        return DB::table('items')
            ->whereIn('id', $itemIds)
            ->get(['id', 'name', 'buy_price'])
            ->keyBy(fn ($item) => (string) $item->id)
            ->map(fn ($item) => [
                'id' => (int) $item->id,
                'name' => $item->name,
                'buy_price' => (int) ($item->buy_price ?? 0),
            ])
            ->toArray();
    }

    private function normalizeMaterialsJson($materialsJson, array $itemMap): string
    {
        $materials = $this->decodeJsonArray($materialsJson);

        $normalized = [];

        foreach ($materials as $material) {
            if (is_string($material)) {
                $normalized[] = [
                    'item_id' => null,
                    'name' => $material,
                    'qty' => 1,
                    'defaultUnitCost' => 0,
                ];
                continue;
            }

            if (!is_array($material)) {
                continue;
            }

            $itemId = $this->extractMaterialItemId($material);
            $master = $itemId ? ($itemMap[(string) $itemId] ?? null) : null;

            $name =
                $material['name']
                ?? $material['material_name']
                ?? $material['item_name']
                ?? $material['label']
                ?? ($master['name'] ?? null);

            $qty =
                $material['qty']
                ?? $material['quantity']
                ?? $material['count']
                ?? $material['num']
                ?? 0;

            $defaultUnitCost =
                $material['defaultUnitCost']
                ?? $material['default_unit_cost']
                ?? $material['unitCost']
                ?? $material['unit_cost']
                ?? $material['price']
                ?? ($master['buy_price'] ?? 0);

            $normalized[] = [
                'item_id' => $itemId ? (int) $itemId : null,
                'name' => $name ?: '不明な素材',
                'qty' => (int) $qty,
                'defaultUnitCost' => (int) $defaultUnitCost,
            ];
        }

        return json_encode($normalized, JSON_UNESCAPED_UNICODE);
    }

    private function extractMaterialItemId(array $material): ?string
    {
        $itemId =
            $material['item_id']
            ?? $material['itemId']
            ?? $material['id']
            ?? null;

        if ($itemId === null || $itemId === '') {
            return null;
        }

        return (string) $itemId;
    }

    private function decodeJsonArray($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || $value === '') {
            return [];
        }

        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function normalizeJsonValue($value, $fallback)
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || $value === '') {
            return $fallback;
        }

        try {
            return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            return $fallback;
        }
    }
}
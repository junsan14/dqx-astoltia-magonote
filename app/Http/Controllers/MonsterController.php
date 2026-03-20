<?php

namespace App\Http\Controllers;

use App\Models\Monster;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MonsterController extends Controller
{
    public function index(Request $request)
    {
        $keyword = trim((string) $request->get('keyword', ''));
        $searchType = (string) $request->get('search_type', 'monster');

        if ($searchType === 'monster') {
            $monsters = Monster::query()
                ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
                ->selectRaw('
                    monsters.id,
                    monsters.display_order as monster_no,
                    monsters.display_order,
                    monsters.name,
                    monsters.system_type,
                    monsters.source_url,
                    monsters.is_reincarnated,
                    monsters.reincarnation_parent_id,
                    parents.name as reincarnation_parent_name
                ')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('monsters.name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN monsters.name = ? THEN 0
                                WHEN monsters.name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(monsters.name) ASC')
                        ->orderBy('monsters.name');
                }, function ($query) {
                    $query->orderBy('monsters.name');
                })
                ->limit(300)
                ->get();

            return response()->json(
                $this->attachDropSummaries($monsters, 'monster', $keyword)
            );
        }

        if ($searchType === 'item') {
            $monsters = Monster::query()
                ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
                ->selectRaw('
                    monsters.id,
                    monsters.display_order as monster_no,
                    monsters.display_order,
                    monsters.name,
                    monsters.system_type,
                    monsters.source_url,
                    monsters.is_reincarnated,
                    monsters.reincarnation_parent_id,
                    parents.name as reincarnation_parent_name,
                    items.name as matched_name
                ')
                ->join('monster_drops', function ($join) {
                    $join->on('monster_drops.monster_id', '=', 'monsters.id')
                        ->where('monster_drops.drop_target_type', '=', 'item');
                })
                ->join('items', 'items.id', '=', 'monster_drops.drop_target_id')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('items.name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN items.name = ? THEN 0
                                WHEN items.name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(items.name) ASC')
                        ->orderBy('items.name')
                        ->orderBy('monsters.name');
                }, function ($query) {
                    $query->orderBy('monsters.name');
                })
                ->limit(200)
                ->get()
                ->unique('id')
                ->values();

            return response()->json(
                $this->attachDropSummaries($monsters, 'item', $keyword)
            );
        }

        if ($searchType === 'orb') {
            $monsters = Monster::query()
                ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
                ->selectRaw('
                    monsters.id,
                    monsters.display_order as monster_no,
                    monsters.display_order,
                    monsters.name,
                    monsters.system_type,
                    monsters.source_url,
                    monsters.is_reincarnated,
                    monsters.reincarnation_parent_id,
                    parents.name as reincarnation_parent_name,
                    orbs.name as matched_name,
                    orbs.color as matched_color
                ')
                ->join('monster_drops', function ($join) {
                    $join->on('monster_drops.monster_id', '=', 'monsters.id')
                        ->where('monster_drops.drop_target_type', '=', 'orb');
                })
                ->join('orbs', 'orbs.id', '=', 'monster_drops.drop_target_id')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('orbs.name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN orbs.name = ? THEN 0
                                WHEN orbs.name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(orbs.name) ASC')
                        ->orderBy('orbs.name')
                        ->orderBy('monsters.name');
                }, function ($query) {
                    $query->orderBy('monsters.name');
                })
                ->limit(200)
                ->get()
                ->unique('id')
                ->values();

            return response()->json(
                $this->attachDropSummaries($monsters, 'orb', $keyword)
            );
        }

        if ($searchType === 'equipment') {
            $monsters = Monster::query()
                ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
                ->selectRaw('
                    monsters.id,
                    monsters.display_order as monster_no,
                    monsters.display_order,
                    monsters.name,
                    monsters.system_type,
                    monsters.source_url,
                    monsters.is_reincarnated,
                    monsters.reincarnation_parent_id,
                    parents.name as reincarnation_parent_name,
                    equipments.item_name as matched_name
                ')
                ->join('monster_drops', function ($join) {
                    $join->on('monster_drops.monster_id', '=', 'monsters.id')
                        ->where('monster_drops.drop_target_type', '=', 'equipment');
                })
                ->join('equipments', 'equipments.id', '=', 'monster_drops.drop_target_id')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('equipments.item_name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN equipments.item_name = ? THEN 0
                                WHEN equipments.item_name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(equipments.item_name) ASC')
                        ->orderBy('equipments.item_name')
                        ->orderBy('monsters.name');
                }, function ($query) {
                    $query->orderBy('monsters.name');
                })
                ->limit(200)
                ->get()
                ->unique('id')
                ->values();

            return response()->json(
                $this->attachDropSummaries($monsters, 'equipment', $keyword)
            );
        }

        if ($searchType === 'accessory') {
            $monsters = Monster::query()
                ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
                ->selectRaw('
                    monsters.id,
                    monsters.display_order as monster_no,
                    monsters.display_order,
                    monsters.name,
                    monsters.system_type,
                    monsters.source_url,
                    monsters.is_reincarnated,
                    monsters.reincarnation_parent_id,
                    parents.name as reincarnation_parent_name,
                    accessories.name as matched_name
                ')
                ->join('monster_drops', function ($join) {
                    $join->on('monster_drops.monster_id', '=', 'monsters.id')
                        ->where('monster_drops.drop_target_type', '=', 'accessory');
                })
                ->join('accessories', 'accessories.id', '=', 'monster_drops.drop_target_id')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('accessories.name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN accessories.name = ? THEN 0
                                WHEN accessories.name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(accessories.name) ASC')
                        ->orderBy('accessories.name')
                        ->orderBy('monsters.name');
                }, function ($query) {
                    $query->orderBy('monsters.name');
                })
                ->limit(200)
                ->get()
                ->unique('id')
                ->values();

            return response()->json(
                $this->attachDropSummaries($monsters, 'accessory', $keyword)
            );
        }

        return response()->json([]);
    }

    public function show($id)
    {
        $monster = Monster::query()
            ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
            ->selectRaw('
                monsters.id,
                monsters.display_order as monster_no,
                monsters.display_order,
                monsters.name,
                monsters.system_type,
                monsters.source_url,
                monsters.is_reincarnated,
                monsters.reincarnation_parent_id,
                parents.name as reincarnation_parent_name,
                monsters.created_at,
                monsters.updated_at
            ')
            ->where('monsters.id', $id)
            ->firstOrFail();

        $drops = DB::table('monster_drops')
            ->leftJoin('items', function ($join) {
                $join->on('items.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'item');
            })
            ->leftJoin('orbs', function ($join) {
                $join->on('orbs.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'orb');
            })
            ->leftJoin('equipments', function ($join) {
                $join->on('equipments.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'equipment');
            })
            ->leftJoin('equipment_types', 'equipment_types.id', '=', 'equipments.equipment_type_id')
            ->leftJoin('accessories', function ($join) {
                $join->on('accessories.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'accessory');
            })
            ->where('monster_drops.monster_id', $monster->id)
            ->orderByRaw("
                CASE
                    WHEN monster_drops.drop_target_type = 'item' AND monster_drops.drop_type = 'normal' THEN 1
                    WHEN monster_drops.drop_target_type = 'item' AND monster_drops.drop_type = 'rare' THEN 2
                    WHEN monster_drops.drop_type = 'white_box' THEN 3
                    WHEN monster_drops.drop_target_type = 'orb' THEN 4
                    WHEN monster_drops.drop_target_type = 'equipment' THEN 5
                    WHEN monster_drops.drop_target_type = 'accessory' THEN 6
                    ELSE 99
                END
            ")
            ->orderBy('monster_drops.sort_order')
            ->orderBy('monster_drops.id')
            ->get([
                'monster_drops.id',
                'monster_drops.monster_id',
                'monster_drops.drop_target_type',
                'monster_drops.drop_target_id',
                'monster_drops.drop_type',
                'monster_drops.sort_order',

                'items.name as item_name',
                'items.category as item_category',

                'orbs.name as orb_name',
                'orbs.color as orb_color',
                'orbs.effect as orb_effect',

                'equipments.item_name as equipment_name',
                'equipments.slot as equipment_slot',
                'equipment_types.name as equipment_type_name',

                'accessories.name as accessory_name',
                'accessories.slot as accessory_slot',
                'accessories.accessory_type as accessory_type',
            ])
            ->map(function ($drop) {
                $name = null;
                $category = null;
                $extra = [];

                if ($drop->drop_target_type === 'item') {
                    $name = $drop->item_name;
                    $category = $drop->item_category;
                }

                if ($drop->drop_target_type === 'orb') {
                    $name = $drop->orb_name;
                    $category = 'orb';
                    $extra = [
                        'color' => $drop->orb_color,
                        'effect' => $drop->orb_effect,
                    ];
                }

                if ($drop->drop_target_type === 'equipment') {
                    $name = $drop->equipment_name;
                    $category = 'equipment';
                    $extra = [
                        'slot' => $drop->equipment_slot,
                        'equipment_type_name' => $drop->equipment_type_name,
                    ];
                }

                if ($drop->drop_target_type === 'accessory') {
                    $name = $drop->accessory_name;
                    $category = 'accessory';
                    $extra = [
                        'slot' => $drop->accessory_slot,
                        'accessory_type' => $drop->accessory_type,
                    ];
                }

                return [
                    'id' => $drop->id,
                    'monster_id' => $drop->monster_id,
                    'drop_target_type' => $drop->drop_target_type,
                    'drop_target_id' => $drop->drop_target_id,
                    'drop_type' => $drop->drop_type,
                    'drop_type_label' => $this->dropTypeLabel($drop->drop_type, $drop->drop_target_type),
                    'sort_order' => $drop->sort_order,
                    'name' => $name,
                    'target_name' => $name,
                    'category' => $category,
                    ...$extra,
                ];
            })
            ->filter(fn ($drop) => !empty($drop['name']))
            ->values();

        $maps = DB::table('monster_map_spawns')
            ->join('maps', 'maps.id', '=', 'monster_map_spawns.map_id')
            ->leftJoin('map_layers', 'map_layers.id', '=', 'monster_map_spawns.map_layer_id')
            ->where('monster_map_spawns.monster_id', $monster->id)
            ->orderBy('maps.name')
            ->orderBy('map_layers.display_order')
            ->orderBy('map_layers.floor_no')
            ->orderBy('monster_map_spawns.id')
            ->get([
                'monster_map_spawns.id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.map_layer_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.spawn_count',
                'monster_map_spawns.symbol_count',
                'monster_map_spawns.note',

                'maps.name as map_name',
                'maps.continent as map_continent',

                'map_layers.layer_name as map_layer_name',
                'map_layers.floor_no as map_layer_floor_no',
                'map_layers.image_path as map_layer_image_path',
            ])
            ->groupBy('map_id')
            ->map(function ($rows, $mapId) {
                $first = $rows->first();

                $mapImagePath = collect($rows)
                    ->pluck('map_layer_image_path')
                    ->filter(fn ($path) => !empty($path))
                    ->first();

                return [
                    'id' => (int) $mapId,
                    'name' => $first->map_name,
                    'continent' => $first->map_continent,
                    'continent_name' => $first->map_continent,
                    'image_path' => $mapImagePath,
                    'spawns' => $rows->map(function ($row) use ($mapImagePath) {
                        $layerName = trim((string) ($row->map_layer_name ?? ''));

                        if ($layerName === '' && $row->map_layer_floor_no !== null) {
                            $floorNo = (int) $row->map_layer_floor_no;

                            if ($floorNo === 0) {
                                $layerName = '地上';
                            } elseif ($floorNo < 0) {
                                $layerName = '地下' . abs($floorNo) . '階';
                            } else {
                                $layerName = $floorNo . '階';
                            }
                        }

                        return [
                            'id' => $row->id,
                            'map_id' => $row->map_id,
                            'map_layer_id' => $row->map_layer_id,
                            'area' => $this->parseArea($row->area),
                            'spawn_time' => $row->spawn_time,
                            'spawn_count' => $row->spawn_count,
                            'symbol_count' => $row->symbol_count,
                            'note' => $row->note,
                            'map_layer_name' => $layerName,
                            'map_layer_floor_no' => $row->map_layer_floor_no,
                            'map_image_path' => $row->map_layer_image_path ?: $mapImagePath,
                        ];
                    })->values(),
                ];
            })
            ->values();

        return response()->json([
            'id' => $monster->id,
            'monster_no' => $monster->monster_no,
            'display_order' => $monster->display_order,
            'name' => $monster->name,
            'system_type' => $monster->system_type,
            'source_url' => $monster->source_url,
            'is_reincarnated' => (bool) $monster->is_reincarnated,
            'reincarnation_parent_id' => $monster->reincarnation_parent_id ? (int) $monster->reincarnation_parent_id : null,
            'reincarnation_parent_name' => $monster->reincarnation_parent_name,
            'created_at' => $monster->created_at,
            'updated_at' => $monster->updated_at,

            'drops' => $drops,

            'normal_drops' => $drops
                ->where('drop_target_type', 'item')
                ->where('drop_type', 'normal')
                ->values(),

            'rare_drops' => $drops
                ->where('drop_target_type', 'item')
                ->where('drop_type', 'rare')
                ->values(),

            'white_box_drops' => $drops
                ->where('drop_type', 'white_box')
                ->values(),

            'orb_drops' => $drops
                ->where('drop_target_type', 'orb')
                ->values(),

            'equipment_drops' => $drops
                ->where('drop_target_type', 'equipment')
                ->values(),

            'accessory_drops' => $drops
                ->where('drop_target_type', 'accessory')
                ->values(),

            'maps' => $maps,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateMonsterPayload($request);

        $monster = DB::transaction(function () use ($validated) {
            $newOrder = max(1, (int) $validated['display_order']);

            Monster::where('display_order', '>=', $newOrder)
                ->increment('display_order');

            $parentId = !empty($validated['reincarnation_parent_id'])
                ? (int) $validated['reincarnation_parent_id']
                : null;

            $monster = Monster::create([
                'display_order' => $newOrder,
                'name' => $validated['name'],
                'system_type' => $validated['system_type'] ?? null,
                'source_url' => $validated['source_url'] ?? null,
                'is_reincarnated' => !empty($parentId),
                'reincarnation_parent_id' => $parentId,
            ]);

            $this->syncMonsterDrops($monster->id, $validated['drops'] ?? []);

            return $monster;
        });

        return $this->show($monster->id);
    }

    public function update(Request $request, $id)
    {
        $monster = Monster::findOrFail($id);
        $validated = $this->validateMonsterPayload($request, (int) $id);

        DB::transaction(function () use ($monster, $validated) {
            $oldOrder = (int) $monster->display_order;
            $newOrder = max(1, (int) $validated['display_order']);

            if ($newOrder < $oldOrder) {
                Monster::where('id', '!=', $monster->id)
                    ->whereBetween('display_order', [$newOrder, $oldOrder - 1])
                    ->increment('display_order');
            } elseif ($newOrder > $oldOrder) {
                Monster::where('id', '!=', $monster->id)
                    ->whereBetween('display_order', [$oldOrder + 1, $newOrder])
                    ->decrement('display_order');
            }

            $parentId = !empty($validated['reincarnation_parent_id'])
                ? (int) $validated['reincarnation_parent_id']
                : null;

            $monster->update([
                'display_order' => $newOrder,
                'name' => $validated['name'],
                'system_type' => $validated['system_type'] ?? null,
                'source_url' => $validated['source_url'] ?? null,
                'is_reincarnated' => !empty($parentId),
                'reincarnation_parent_id' => $parentId,
            ]);

            $this->syncMonsterDrops($monster->id, $validated['drops'] ?? []);
        });

        return $this->show($monster->id);
    }

    public function destroy($id)
    {
        $monster = Monster::findOrFail($id);

        DB::transaction(function () use ($monster) {
            $deletedOrder = (int) $monster->display_order;
            $monsterId = $monster->id;

            DB::table('monster_drops')
                ->where('monster_id', $monsterId)
                ->delete();

            DB::table('monster_map_spawns')
                ->where('monster_id', $monsterId)
                ->delete();

            DB::table('monsters')
                ->where('reincarnation_parent_id', $monsterId)
                ->update([
                    'is_reincarnated' => false,
                    'reincarnation_parent_id' => null,
                ]);

            $monster->delete();

            Monster::where('display_order', '>', $deletedOrder)
                ->decrement('display_order');
        });

        return response()->json([
            'message' => '削除した',
        ]);
    }

    public function aroundDisplayOrder(Request $request)
    {
        $displayOrder = (int) $request->query('display_order', 0);
        $range = (int) $request->query('range', 5);
        $excludeId = (int) $request->query('exclude_id', 0);

        if ($displayOrder < 1) {
            return response()->json([
                'data' => [],
            ]);
        }

        $range = max(1, min($range, 20));

        $query = Monster::query()
            ->select(['id', 'display_order', 'name'])
            ->whereBetween('display_order', [
                max(1, $displayOrder - $range),
                $displayOrder + $range,
            ])
            ->orderBy('display_order')
            ->orderBy('id');

        if ($excludeId > 0) {
            $query->where('id', '!=', $excludeId);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function zukan(Request $request)
{
    $perPage = max(1, min((int) $request->query('per_page', 16), 100));
    $sort = $request->query('sort', 'no');

    $query = Monster::query()
        ->leftJoin('monsters as parents', 'parents.id', '=', 'monsters.reincarnation_parent_id')
        ->selectRaw('
            monsters.id,
            monsters.display_order as monster_no,
            monsters.display_order,
            monsters.name,
            monsters.system_type,
            monsters.source_url,
            monsters.is_reincarnated,
            monsters.reincarnation_parent_id,
            parents.name as reincarnation_parent_name
        ');

    if ($sort === 'kana') {
        $query
            ->orderBy('monsters.name')
            ->orderBy('monsters.id');
    } else {
        $query
            ->orderBy('monsters.display_order')
            ->orderBy('monsters.id');
    }

    $monsters = $query->paginate($perPage);

    $items = collect($monsters->items())->map(function ($monster) {
        return [
            'id' => $monster->id,
            'monster_no' => $monster->monster_no,
            'display_order' => $monster->display_order ?? $monster->monster_no,
            'name' => $monster->name,
            'system_type' => $monster->system_type,
            'source_url' => $monster->source_url ?? null,
            'is_reincarnated' => (bool) ($monster->is_reincarnated ?? false),
            'reincarnation_parent_id' => !empty($monster->reincarnation_parent_id)
                ? (int) $monster->reincarnation_parent_id
                : null,
            'reincarnation_parent_name' => $monster->reincarnation_parent_name ?? null,
        ];
    })->values();

    return response()->json([
        'data' => $items,
        'current_page' => $monsters->currentPage(),
        'last_page' => $monsters->lastPage(),
        'per_page' => $monsters->perPage(),
        'total' => $monsters->total(),
    ]);
}

    private function validateMonsterPayload(Request $request, ?int $monsterId = null): array
    {
        return $request->validate([
            'display_order' => ['required', 'integer', 'min:0'],
            'name' => ['required', 'string', 'max:255'],
            'system_type' => ['nullable', 'string', 'max:255'],
            'source_url' => ['nullable', 'string'],
            'reincarnation_parent_id' => [
                'nullable',
                'integer',
                'min:1',
                Rule::exists('monsters', 'id'),
                Rule::notIn(array_filter([$monsterId])),
            ],
            'drops' => ['nullable', 'array'],
            'drops.*.id' => ['nullable', 'integer'],
            'drops.*.drop_target_type' => ['required', Rule::in(['item', 'orb', 'equipment', 'accessory'])],
            'drops.*.drop_target_id' => ['nullable', 'integer', 'min:1'],
            'drops.*.drop_type' => ['required', 'string', 'max:50'],
            'drops.*.sort_order' => ['required', 'integer', 'min:1'],
        ]);
    }

    private function syncMonsterDrops(int $monsterId, array $drops): void
    {
        $keepIds = [];

        foreach ($drops as $index => $drop) {
            $targetId = (int) ($drop['drop_target_id'] ?? 0);

            if ($targetId <= 0) {
                continue;
            }

            $rowId = (int) ($drop['id'] ?? 0);

            $payload = [
                'monster_id' => $monsterId,
                'drop_target_type' => (string) ($drop['drop_target_type'] ?? 'item'),
                'drop_target_id' => $targetId,
                'drop_type' => (string) ($drop['drop_type'] ?? 'normal'),
                'sort_order' => (int) ($drop['sort_order'] ?? ($index + 1)),
            ];

            if ($rowId > 0) {
                $exists = DB::table('monster_drops')
                    ->where('id', $rowId)
                    ->where('monster_id', $monsterId)
                    ->exists();

                if ($exists) {
                    DB::table('monster_drops')
                        ->where('id', $rowId)
                        ->where('monster_id', $monsterId)
                        ->update($payload);

                    $keepIds[] = $rowId;
                    continue;
                }
            }

            $newId = DB::table('monster_drops')->insertGetId($payload);
            $keepIds[] = $newId;
        }

        $deleteQuery = DB::table('monster_drops')->where('monster_id', $monsterId);

        if (!empty($keepIds)) {
            $deleteQuery->whereNotIn('id', $keepIds);
        }

        $deleteQuery->delete();
    }

    private function parseArea($area): array
    {
        if (empty($area)) {
            return [];
        }

        if (is_array($area)) {
            return array_values(array_filter($area));
        }

        if (is_string($area)) {
            $decoded = json_decode($area, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return array_values(array_filter($decoded));
            }

            return array_values(array_filter(
                array_map('trim', explode(',', $area))
            ));
        }

        return [];
    }

    private function attachDropSummaries(Collection $monsters, string $searchType, string $keyword = ''): Collection
    {
        $monsterIds = $monsters->pluck('id')->unique()->values();

        if ($monsterIds->isEmpty()) {
            return collect();
        }

        $drops = DB::table('monster_drops')
            ->leftJoin('items', function ($join) {
                $join->on('items.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'item');
            })
            ->leftJoin('orbs', function ($join) {
                $join->on('orbs.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'orb');
            })
            ->leftJoin('equipments', function ($join) {
                $join->on('equipments.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'equipment');
            })
            ->leftJoin('equipment_types', 'equipment_types.id', '=', 'equipments.equipment_type_id')
            ->leftJoin('accessories', function ($join) {
                $join->on('accessories.id', '=', 'monster_drops.drop_target_id')
                    ->where('monster_drops.drop_target_type', '=', 'accessory');
            })
            ->whereIn('monster_drops.monster_id', $monsterIds)
            ->orderByRaw("
                CASE
                    WHEN monster_drops.drop_target_type = 'item' AND monster_drops.drop_type = 'normal' THEN 1
                    WHEN monster_drops.drop_target_type = 'item' AND monster_drops.drop_type = 'rare' THEN 2
                    WHEN monster_drops.drop_type = 'white_box' THEN 3
                    WHEN monster_drops.drop_target_type = 'orb' THEN 4
                    WHEN monster_drops.drop_target_type = 'equipment' THEN 5
                    WHEN monster_drops.drop_target_type = 'accessory' THEN 6
                    ELSE 99
                END
            ")
            ->orderBy('monster_drops.sort_order')
            ->orderBy('monster_drops.id')
            ->get([
                'monster_drops.monster_id',
                'monster_drops.drop_target_type',
                'monster_drops.drop_type',
                'monster_drops.sort_order',
                'items.name as item_name',
                'orbs.name as orb_name',
                'orbs.color as orb_color',
                'equipments.item_name as equipment_name',
                'equipments.slot as equipment_slot',
                'equipment_types.name as equipment_type_name',
                'accessories.name as accessory_name',
            ])
            ->groupBy('monster_id');

        return $monsters->map(function ($monster) use ($drops, $searchType, $keyword) {
            $monsterDrops = collect($drops[$monster->id] ?? []);

            $normalDrops = $monsterDrops
                ->where('drop_target_type', 'item')
                ->where('drop_type', 'normal')
                ->pluck('item_name')
                ->filter()
                ->unique()
                ->values();

            $rareDrops = $monsterDrops
                ->where('drop_target_type', 'item')
                ->where('drop_type', 'rare')
                ->pluck('item_name')
                ->filter()
                ->unique()
                ->values();

            $whiteBoxDrops = $monsterDrops
                ->where('drop_type', 'white_box')
                ->map(function ($drop) {
                    if ($drop->drop_target_type === 'item') {
                        return [
                            'name' => $drop->item_name,
                            'slot' => null,
                            'equipment_type_name' => null,
                        ];
                    }

                    if ($drop->drop_target_type === 'equipment') {
                        return [
                            'name' => $drop->equipment_name,
                            'slot' => $drop->equipment_slot,
                            'equipment_type_name' => $drop->equipment_type_name,
                        ];
                    }

                    if ($drop->drop_target_type === 'orb') {
                        return [
                            'name' => $drop->orb_name,
                            'color' => $drop->orb_color,
                        ];
                    }

                    if ($drop->drop_target_type === 'accessory') {
                        return [
                            'name' => $drop->accessory_name,
                        ];
                    }

                    return null;
                })
                ->filter()
                ->unique(fn ($drop) => json_encode($drop, JSON_UNESCAPED_UNICODE))
                ->values();

            $orbDrops = $monsterDrops
                ->where('drop_target_type', 'orb')
                ->map(function ($drop) {
                    return [
                        'name' => $drop->orb_name,
                        'color' => $drop->orb_color,
                    ];
                })
                ->filter(fn ($orb) => !empty($orb['name']))
                ->unique(fn ($orb) => $orb['name'])
                ->values();

            $equipmentDrops = $monsterDrops
                ->where('drop_target_type', 'equipment')
                ->map(function ($drop) {
                    return [
                        'name' => $drop->equipment_name,
                        'slot' => $drop->equipment_slot,
                        'equipment_type_name' => $drop->equipment_type_name,
                    ];
                })
                ->filter(fn ($equipment) => !empty($equipment['name']))
                ->unique(fn ($equipment) => $equipment['name'])
                ->values();

            $accessoryDrops = $monsterDrops
                ->where('drop_target_type', 'accessory')
                ->pluck('accessory_name')
                ->filter()
                ->unique()
                ->values();

            return [
                'id' => $monster->id,
                'monster_no' => $monster->monster_no,
                'display_order' => $monster->display_order ?? $monster->monster_no,
                'name' => $monster->name,
                'system_type' => $monster->system_type,
                'source_url' => $monster->source_url ?? null,
                'is_reincarnated' => (bool) ($monster->is_reincarnated ?? false),
                'reincarnation_parent_id' => !empty($monster->reincarnation_parent_id)
                    ? (int) $monster->reincarnation_parent_id
                    : null,
                'reincarnation_parent_name' => $monster->reincarnation_parent_name ?? null,
                'matched_name' => $monster->matched_name ?? null,
                'matched_color' => $monster->matched_color ?? null,
                'search_type' => $searchType,
                'is_exact_match' => match ($searchType) {
                    'monster' => $keyword !== '' && $monster->name === $keyword,
                    'item', 'equipment', 'orb', 'accessory' => $keyword !== '' && (($monster->matched_name ?? null) === $keyword),
                    default => false,
                },
                'normal_drops' => $normalDrops,
                'rare_drops' => $rareDrops,
                'white_box_drops' => $whiteBoxDrops,
                'orb_drops' => $orbDrops,
                'equipment_drops' => $equipmentDrops,
                'accessory_drops' => $accessoryDrops,
            ];
        })->values();
    }

    private function dropTypeLabel(?string $dropType, ?string $dropTargetType = null): string
    {
        if ($dropType === 'normal') {
            return '通常ドロップ';
        }

        if ($dropType === 'rare') {
            return 'レアドロップ';
        }

        if ($dropType === 'white_box') {
            return '白宝箱';
        }

        if ($dropType === 'orb' || $dropTargetType === 'orb') {
            return '宝珠';
        }

        if ($dropType === 'equipment' || $dropTargetType === 'equipment') {
            return '装備';
        }

        if ($dropType === 'accessory' || $dropTargetType === 'accessory') {
            return 'アクセサリ';
        }

        return $dropType ?? '';
    }
}
<?php

namespace App\Http\Controllers;

use App\Models\Monster;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MonsterController extends Controller
{
    public function index(Request $request)
    {
        $keyword = trim((string) $request->get('keyword', ''));
        $searchType = (string) $request->get('search_type', 'monster');

        if ($searchType === 'monster') {
            $monsters = Monster::query()
                ->select('id', 'monster_no', 'name', 'system_type')
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN name = ? THEN 0
                                WHEN name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(name) ASC')
                        ->orderBy('name');
                }, function ($query) {
                    $query->orderBy('name');
                })
                ->limit(100)
                ->get();

            return response()->json(
                $this->attachDropSummaries($monsters, 'monster', $keyword)
            );
        }

        if ($searchType === 'item') {
            $monsters = Monster::query()
                ->select(
                    'monsters.id',
                    'monsters.monster_no',
                    'monsters.name',
                    'monsters.system_type',
                    'items.name as matched_name'
                )
                ->join('monster_drops', 'monster_drops.monster_id', '=', 'monsters.id')
                ->join('items', function ($join) {
                    $join->on('items.id', '=', 'monster_drops.drop_target_id')
                        ->where('monster_drops.drop_target_type', '=', 'item');
                })
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
                ->select(
                    'monsters.id',
                    'monsters.monster_no',
                    'monsters.name',
                    'monsters.system_type',
                    'orbs.name as matched_name',
                    'orbs.color as matched_color'
                )
                ->join('monster_drops', 'monster_drops.monster_id', '=', 'monsters.id')
                ->join('orbs', function ($join) {
                    $join->on('orbs.id', '=', 'monster_drops.drop_target_id')
                        ->where('monster_drops.drop_target_type', '=', 'orb');
                })
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
                ->select(
                    'monsters.id',
                    'monsters.monster_no',
                    'monsters.name',
                    'monsters.system_type',
                    'equipments.name as matched_name'
                )
                ->join('monster_drops', 'monster_drops.monster_id', '=', 'monsters.id')
                ->join('equipments', function ($join) {
                    $join->on('equipments.id', '=', 'monster_drops.drop_target_id')
                        ->where('monster_drops.drop_target_type', '=', 'equipment');
                })
                ->when($keyword !== '', function ($query) use ($keyword) {
                    $escapedKeyword = addcslashes($keyword, '\\%_');

                    $query->where('equipments.name', 'like', '%' . $escapedKeyword . '%')
                        ->orderByRaw(
                            "
                            CASE
                                WHEN equipments.name = ? THEN 0
                                WHEN equipments.name LIKE ? THEN 1
                                ELSE 2
                            END
                            ",
                            [$keyword, $escapedKeyword . '%']
                        )
                        ->orderByRaw('LENGTH(equipments.name) ASC')
                        ->orderBy('equipments.name')
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

        return response()->json([]);
    }

public function show($id)
{
    $monster = Monster::query()
        ->select(
            'id',
            'monster_no',
            'name',
            'system_type',
            'source_url',
            'created_at',
            'updated_at'
        )
        ->findOrFail($id);

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
        ->where('monster_drops.monster_id', $monster->id)
        ->orderByRaw("
            CASE monster_drops.drop_type
                WHEN 'normal' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'white_box' THEN 3
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

            'equipments.name as equipment_name',
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
            }

            return [
                'id' => $drop->id,
                'monster_id' => $drop->monster_id,
                'drop_target_type' => $drop->drop_target_type,
                'drop_target_id' => $drop->drop_target_id,
                'drop_type' => $drop->drop_type,
                'drop_type_label' => $this->dropTypeLabel($drop->drop_type),
                'sort_order' => $drop->sort_order,
                'name' => $name,
                'category' => $category,
                ...$extra,
            ];
        })
        ->filter(fn ($drop) => !empty($drop['name']))
        ->values();

    $maps = DB::table('monster_map_spawns')
        ->join('maps', 'maps.id', '=', 'monster_map_spawns.map_id')
        ->where('monster_map_spawns.monster_id', $monster->id)
        ->orderBy('maps.name')
        ->orderBy('monster_map_spawns.id')
        ->get([
            'monster_map_spawns.id',
            'monster_map_spawns.map_id',
            'monster_map_spawns.area',
            'monster_map_spawns.spawn_time',
            'monster_map_spawns.note',
            'maps.name as map_name',
            'maps.image_path',
        ])
        ->groupBy('map_id')
        ->map(function ($rows, $mapId) {
            $first = $rows->first();

            return [
                'id' => (int) $mapId,
                'name' => $first->map_name,
                'image_path' => $first->image_path,
                'spawns' => $rows->map(function ($row) {
                    return [
                        'id' => $row->id,
                        'area' => $this->parseArea($row->area),
                        'spawn_time' => $row->spawn_time,
                        'note' => $row->note,
                    ];
                })->values(),
            ];
        })
        ->values();

    return response()->json([
        'id' => $monster->id,
        'monster_no' => $monster->monster_no,
        'name' => $monster->name,
        'system_type' => $monster->system_type,
        'source_url' => $monster->source_url,

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

        'maps' => $maps,
    ]);
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
            ->whereIn('monster_drops.monster_id', $monsterIds)
            ->orderBy('monster_drops.sort_order')
            ->orderBy('monster_drops.id')
            ->get([
                'monster_drops.monster_id',
                'monster_drops.drop_target_type',
                'monster_drops.drop_type',
                'items.name as item_name',
                'orbs.name as orb_name',
                'orbs.color as orb_color',
                'equipments.name as equipment_name',
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
                ->pluck('equipment_name')
                ->filter()
                ->unique()
                ->values();

            return [
                'id' => $monster->id,
                'monster_no' => $monster->monster_no,
                'name' => $monster->name,
                'system_type' => $monster->system_type,
                'matched_name' => $monster->matched_name ?? null,
                'matched_color' => $monster->matched_color ?? null,
                'search_type' => $searchType,
                'is_exact_match' => match ($searchType) {
                    'monster' => $keyword !== '' && $monster->name === $keyword,
                    'item', 'equipment', 'orb' => $keyword !== '' && (($monster->matched_name ?? null) === $keyword),
                    default => false,
                },
                'normal_drops' => $normalDrops,
                'rare_drops' => $rareDrops,
                'orb_drops' => $orbDrops,
                'equipment_drops' => $equipmentDrops,
            ];
        })->values();
    }

    private function dropTypeLabel(?string $dropType): string
    {
        return match ($dropType) {
            'normal' => '通常ドロップ',
            'rare' => 'レアドロップ',
            'white_box' => '白宝箱',
            default => $dropType ?? '',
        };
    }
}
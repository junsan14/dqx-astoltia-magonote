<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonsterMapSpawnController extends Controller
{
    private function buildLayerDisplayName($layerName, $floorNo): ?string
    {
        $name = trim((string) ($layerName ?? ''));
        if ($name !== '') {
            return $name;
        }

        if ($floorNo === null || $floorNo === '') {
            return null;
        }

        $floorNo = (int) $floorNo;

        if ($floorNo === 0) {
            return '地上';
        }

        if ($floorNo < 0) {
            return '地下' . abs($floorNo) . '階';
        }

        return $floorNo . '階';
    }

    private function normalizeRow(object $row): array
    {
        $coords = [];

        if (!empty($row->area)) {
            $decoded = json_decode($row->area, true);
            if (is_array($decoded)) {
                $coords = $decoded;
            }
        }

        $layerDisplayName = $this->buildLayerDisplayName(
            $row->map_layer_name,
            $row->map_layer_floor_no
        );

        return [
            'id' => $row->id,
            'monster_id' => $row->monster_id,
            'map_id' => $row->map_id,
            'map_layer_id' => $row->map_layer_id,
            'area' => $row->area,
            'coords' => $coords,
            'spawn_time' => $row->spawn_time,
            'spawn_count' => $row->spawn_count,
            'symbol_count' => $row->symbol_count,
            'imported_note' => $row->imported_note,
            'note' => $row->note,
            'is_hunting_ground' => (bool) $row->is_hunting_ground,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'map_name' => $row->map_name,
            'map_layer_name' => $layerDisplayName,
            'map_layer_floor_no' => $row->map_layer_floor_no,
            'map_layer_image_path' => $row->map_layer_image_path,
            'map_image_url' => $row->map_layer_image_path,
        ];
    }

    public function index(Request $request)
    {
        $monsterId = $request->get('monster_id');

        $query = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->leftJoin('map_layers', 'monster_map_spawns.map_layer_id', '=', 'map_layers.id')
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.map_layer_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.spawn_count',
                'monster_map_spawns.symbol_count',
                'monster_map_spawns.imported_note',
                'monster_map_spawns.note',
                'monster_map_spawns.is_hunting_ground',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'map_layers.layer_name as map_layer_name',
                'map_layers.floor_no as map_layer_floor_no',
                'map_layers.image_path as map_layer_image_path'
            )
            ->orderBy('monster_map_spawns.id', 'asc');

        if ($monsterId !== null && $monsterId !== '') {
            $query->where('monster_map_spawns.monster_id', $monsterId);
        }

        $rows = $query->get()->map(function ($row) {
            return $this->normalizeRow($row);
        });

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function show(string $id)
    {
        $row = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->leftJoin('map_layers', 'monster_map_spawns.map_layer_id', '=', 'map_layers.id')
            ->where('monster_map_spawns.id', $id)
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.map_layer_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.spawn_count',
                'monster_map_spawns.symbol_count',
                'monster_map_spawns.imported_note',
                'monster_map_spawns.note',
                'monster_map_spawns.is_hunting_ground',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'map_layers.layer_name as map_layer_name',
                'map_layers.floor_no as map_layer_floor_no',
                'map_layers.image_path as map_layer_image_path'
            )
            ->first();

        if (!$row) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        return response()->json([
            'data' => $this->normalizeRow($row),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'monster_id' => ['required', 'integer', 'exists:monsters,id'],
            'map_id' => ['required', 'integer', 'exists:maps,id'],
            'map_layer_id' => ['nullable', 'integer', 'exists:map_layers,id'],
            'area' => ['nullable', 'string'],
            'spawn_time' => ['nullable', 'string', 'max:255'],
            'spawn_count' => ['nullable', 'string', 'max:255'],
            'symbol_count' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'is_hunting_ground' => ['nullable', 'boolean'],
        ]);

        if (!empty($data['map_layer_id'])) {
            $layerExists = DB::table('map_layers')
                ->where('id', $data['map_layer_id'])
                ->where('map_id', $data['map_id'])
                ->exists();

            if (!$layerExists) {
                return response()->json([
                    'message' => '選択した階層がマップに属していない',
                    'errors' => [
                        'map_layer_id' => ['選択した階層がマップに属していない'],
                    ],
                ], 422);
            }
        }

        $id = DB::table('monster_map_spawns')->insertGetId([
            'monster_id' => $data['monster_id'],
            'map_id' => $data['map_id'],
            'map_layer_id' => $data['map_layer_id'] ?? null,
            'area' => $data['area'] ?? null,
            'spawn_time' => !empty($data['spawn_time']) ? $data['spawn_time'] : 'normal',
            'spawn_count' => array_key_exists('spawn_count', $data) && $data['spawn_count'] !== ''
                ? $data['spawn_count']
                : null,
            'symbol_count' => array_key_exists('symbol_count', $data) && $data['symbol_count'] !== ''
                ? $data['symbol_count']
                : null,
            'note' => $data['note'] ?? null,
            'is_hunting_ground' => (bool) ($data['is_hunting_ground'] ?? false),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->show((string) $id);
    }

    public function update(Request $request, int $id)
    {
        $current = DB::table('monster_map_spawns')->where('id', $id)->first();

        if (!$current) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        $data = $request->validate([
            'monster_id' => ['sometimes', 'required', 'integer', 'exists:monsters,id'],
            'map_id' => ['sometimes', 'required', 'integer', 'exists:maps,id'],
            'map_layer_id' => ['nullable', 'integer', 'exists:map_layers,id'],
            'area' => ['nullable', 'string'],
            'spawn_time' => ['nullable', 'string', 'max:255'],
            'spawn_count' => ['nullable', 'string', 'max:255'],
            'symbol_count' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'is_hunting_ground' => ['nullable', 'boolean'],
        ]);

        $nextMapId = array_key_exists('map_id', $data)
            ? $data['map_id']
            : $current->map_id;

        $nextMapLayerId = array_key_exists('map_layer_id', $data)
            ? $data['map_layer_id']
            : $current->map_layer_id;

        if (!empty($nextMapLayerId)) {
            $layerExists = DB::table('map_layers')
                ->where('id', $nextMapLayerId)
                ->where('map_id', $nextMapId)
                ->exists();

            if (!$layerExists) {
                return response()->json([
                    'message' => '選択した階層がマップに属していない',
                    'errors' => [
                        'map_layer_id' => ['選択した階層がマップに属していない'],
                    ],
                ], 422);
            }
        }

        $updateData = [
            'updated_at' => now(),
        ];

        if (array_key_exists('monster_id', $data)) {
            $updateData['monster_id'] = $data['monster_id'];
        }

        if (array_key_exists('map_id', $data)) {
            $updateData['map_id'] = $data['map_id'];
        }

        if (array_key_exists('map_layer_id', $data)) {
            $updateData['map_layer_id'] = $data['map_layer_id'] ?: null;
        }

        if (array_key_exists('area', $data)) {
            $updateData['area'] = $data['area'] ?? '[]';
        }

        if (array_key_exists('spawn_time', $data)) {
            $updateData['spawn_time'] = !is_null($data['spawn_time']) && $data['spawn_time'] !== ''
                ? $data['spawn_time']
                : 'normal';
        }

        if (array_key_exists('spawn_count', $data)) {
            $updateData['spawn_count'] = !is_null($data['spawn_count']) && $data['spawn_count'] !== ''
                ? $data['spawn_count']
                : null;
        }

        if (array_key_exists('symbol_count', $data)) {
            $updateData['symbol_count'] = !is_null($data['symbol_count']) && $data['symbol_count'] !== ''
                ? $data['symbol_count']
                : null;
        }

        if (array_key_exists('note', $data)) {
            $updateData['note'] = $data['note'];
        }

        if (array_key_exists('is_hunting_ground', $data)) {
            $updateData['is_hunting_ground'] = (bool) $data['is_hunting_ground'];
        }

        DB::table('monster_map_spawns')
            ->where('id', $id)
            ->update($updateData);

        return $this->show((string) $id);
    }

    public function destroy(string $id)
    {
        $exists = DB::table('monster_map_spawns')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        DB::table('monster_map_spawns')
            ->where('id', $id)
            ->delete();

        return response()->json([
            'success' => true,
        ]);
    }
}
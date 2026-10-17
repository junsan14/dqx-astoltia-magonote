<?php

namespace App\Http\Controllers\Api;

use App\Services\MonsterHabitatSyncService;
use Illuminate\Validation\ValidationException;
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
            'monster_name' => $row->monster_name ?? null,
            'reincarnation_parent_id' => $row->reincarnation_parent_id ?? null,
            'monster_name_en' => $row->monster_name_en ?? null,

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

    private function normalizePayload(Request $request): array
    {
        $data = $request->all();

        foreach ([
            'monster_id',
            'map_id',
            'map_layer_id',
            'area',
            'spawn_time',
            'spawn_count',
            'symbol_count',
            'note',
            'imported_note',
            'is_hunting_ground',
        ] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        if (array_key_exists('is_hunting_ground', $data)) {
            $value = $data['is_hunting_ground'];

            if ($value === 'true' || $value === 1 || $value === '1') {
                $data['is_hunting_ground'] = true;
            } elseif ($value === 'false' || $value === 0 || $value === '0') {
                $data['is_hunting_ground'] = false;
            }
        }

        return $data;
    }

    private function validateLayerBelongsToMap(?int $mapId, ?int $mapLayerId): ?array
    {
        if ($mapLayerId === null) {
            return null;
        }

        $layerExists = DB::table('map_layers')
            ->where('id', $mapLayerId)
            ->where('map_id', $mapId)
            ->exists();

        if (!$layerExists) {
            return [
                'message' => '選択した階層がマップに属していない',
                'errors' => [
                    'map_layer_id' => ['選択した階層がマップに属していない'],
                ],
            ];
        }

        return null;
    }

    private function assertEditable(int $monsterId): void
    {
        if (DB::table('monsters')->where('id', $monsterId)->value('reincarnation_parent_id')) {
            throw ValidationException::withMessages([
                'monster_id' => '転生モンスターの生息地は転生元のモンスターから編集してください。',
            ]);
        }
    }

    public function index(Request $request)
{
    $monsterId = $request->get('monster_id');
    $mapId = $request->get('map_id');

    $query = DB::table('monster_map_spawns')
        ->leftJoin('monsters', 'monster_map_spawns.monster_id', '=', 'monsters.id')
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
            'monsters.name as monster_name',
            'monsters.reincarnation_parent_id',
            'monsters.name_en as monster_name_en',
            'maps.name as map_name',
            'map_layers.layer_name as map_layer_name',
            'map_layers.floor_no as map_layer_floor_no',
            'map_layers.image_path as map_layer_image_path'
        )
        ->orderBy('monster_map_spawns.id', 'asc');

    if ($monsterId !== null && $monsterId !== '') {
        $query->where('monster_map_spawns.monster_id', $monsterId);
    }

    if ($mapId !== null && $mapId !== '') {
        $query->where('monster_map_spawns.map_id', $mapId);
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
        ->leftJoin('monsters', 'monster_map_spawns.monster_id', '=', 'monsters.id')
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
            'monsters.name as monster_name',
            'monsters.reincarnation_parent_id',
            'monsters.name_en as monster_name_en',
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
        $input = $this->normalizePayload($request);

        $data = validator($input, [
            'monster_id' => ['required', 'integer', 'exists:monsters,id'],
            'map_id' => ['required', 'integer', 'exists:maps,id'],
            'map_layer_id' => ['nullable', 'integer', 'exists:map_layers,id'],
            'area' => ['nullable', 'string'],
            'spawn_time' => ['nullable', 'string', 'max:255'],
            'spawn_count' => ['nullable', 'string', 'max:255'],
            'symbol_count' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'imported_note' => ['nullable', 'string'],
            'is_hunting_ground' => ['nullable', 'boolean'],
        ])->validate();

        $layerError = $this->validateLayerBelongsToMap(
            (int) $data['map_id'],
            isset($data['map_layer_id']) ? (int) $data['map_layer_id'] : null
        );

        if ($layerError) {
            return response()->json($layerError, 422);
        }

        $this->assertEditable((int) $data['monster_id']);

        $createdId = null;

        DB::transaction(function () use ($data, &$createdId) {
            $spawnData = [
                'monster_id' => (int) $data['monster_id'],
                'map_id' => (int) $data['map_id'],
                'map_layer_id' => $data['map_layer_id'] ?? null,
                'area' => $data['area'] ?? null,
                'spawn_time' => $data['spawn_time'] ?? 'normal',
                'spawn_count' => $data['spawn_count'] ?? null,
                'symbol_count' => $data['symbol_count'] ?? null,
                'note' => $data['note'] ?? null,
                'imported_note' => $data['imported_note'] ?? null,
                'is_hunting_ground' => (bool) ($data['is_hunting_ground'] ?? false),
            ];

            $createdId = DB::table('monster_map_spawns')->insertGetId([
                'monster_id' => $spawnData['monster_id'],
                'map_id' => $spawnData['map_id'],
                'map_layer_id' => $spawnData['map_layer_id'],
                'area' => $spawnData['area'],
                'spawn_time' => $spawnData['spawn_time'],
                'spawn_count' => $spawnData['spawn_count'],
                'symbol_count' => $spawnData['symbol_count'],
                'note' => $spawnData['note'],
                'imported_note' => $spawnData['imported_note'],
                'is_hunting_ground' => $spawnData['is_hunting_ground'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            app(MonsterHabitatSyncService::class)->sync($spawnData['monster_id']);
        });

        return $this->show((string) $createdId);
    }

    public function update(Request $request, int $id)
{
    $current = DB::table('monster_map_spawns')->where('id', $id)->first();

    if (!$current) {
        return response()->json([
            'message' => '生息地が見つからない',
        ], 404);
    }

    $input = $this->normalizePayload($request);

    $data = validator($input, [
        'monster_id' => ['sometimes', 'required', 'integer', 'exists:monsters,id'],
        'map_id' => ['sometimes', 'required', 'integer', 'exists:maps,id'],
        'map_layer_id' => ['sometimes', 'nullable', 'integer', 'exists:map_layers,id'],
        'area' => ['sometimes', 'nullable', 'string'],
        'spawn_time' => ['sometimes', 'nullable', 'string', 'max:255'],
        'spawn_count' => ['sometimes', 'nullable', 'string', 'max:255'],
        'symbol_count' => ['sometimes', 'nullable', 'string', 'max:255'],
        'note' => ['sometimes', 'nullable', 'string'],
        'imported_note' => ['sometimes', 'nullable', 'string'],
        'is_hunting_ground' => ['sometimes', 'nullable', 'boolean'],
    ])->validate();

    $nextMapId = array_key_exists('map_id', $data)
        ? (int) $data['map_id']
        : (int) $current->map_id;

    $nextMapLayerId = array_key_exists('map_layer_id', $data)
        ? $data['map_layer_id']
        : $current->map_layer_id;

    $layerError = $this->validateLayerBelongsToMap(
        $nextMapId,
        $nextMapLayerId !== null ? (int) $nextMapLayerId : null
    );

    if ($layerError) {
        return response()->json($layerError, 422);
    }

    $updateData = [
        'updated_at' => now(),
    ];

    if (array_key_exists('monster_id', $data)) {
        $updateData['monster_id'] = (int) $data['monster_id'];
    }

    if (array_key_exists('map_id', $data)) {
        $updateData['map_id'] = $nextMapId;
    }

    if (array_key_exists('map_layer_id', $data)) {
        $updateData['map_layer_id'] = $nextMapLayerId;
    }

    if (array_key_exists('area', $data)) {
        $updateData['area'] = $data['area'];
    }

    if (array_key_exists('spawn_time', $data)) {
        $updateData['spawn_time'] = $data['spawn_time'] !== null && $data['spawn_time'] !== ''
            ? $data['spawn_time']
            : 'normal';
    }

    if (array_key_exists('spawn_count', $data)) {
        $updateData['spawn_count'] = $data['spawn_count'];
    }

    if (array_key_exists('symbol_count', $data)) {
        $updateData['symbol_count'] = $data['symbol_count'];
    }

    if (array_key_exists('note', $data)) {
        $updateData['note'] = $data['note'];
    }

    if (array_key_exists('imported_note', $data)) {
        $updateData['imported_note'] = $data['imported_note'];
    }

    if (array_key_exists('is_hunting_ground', $data)) {
        $updateData['is_hunting_ground'] = (bool) $data['is_hunting_ground'];
    }

    $this->assertEditable((int) $current->monster_id);
    $nextMonsterId = (int) ($updateData['monster_id'] ?? $current->monster_id);
    $this->assertEditable($nextMonsterId);

    DB::transaction(function () use ($id, $updateData, $current, $nextMonsterId) {
        DB::table('monster_map_spawns')->where('id', $id)->update($updateData);
        $sync = app(MonsterHabitatSyncService::class);
        $sync->sync((int) $current->monster_id);
        if ($nextMonsterId !== (int) $current->monster_id) {
            $sync->sync($nextMonsterId);
        }
    });

    return $this->show((string) $id);
}

    public function destroy(string $id)
    {
        $current = DB::table('monster_map_spawns')->where('id', $id)->first();

        if (!$current) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        $this->assertEditable((int) $current->monster_id);

        DB::transaction(function () use ($current, $id) {
            $monsterId = (int) $current->monster_id;

            DB::table('monster_map_spawns')
                ->where('id', $id)
                ->delete();
            app(MonsterHabitatSyncService::class)->sync($monsterId);
        });

        return response()->json([
            'success' => true,
        ]);
    }
}
<?php

namespace App\Http\Controllers\Api;

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

    private function getReincarnationChildIds(int $parentMonsterId): array
    {
        return DB::table('monsters')
            ->where('reincarnation_parent_id', $parentMonsterId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
    private function findSpawnByMonsterAndLocation(int $monsterId, int $mapId, $mapLayerId): ?object
{
    $query = DB::table('monster_map_spawns')
        ->where('monster_id', $monsterId)
        ->where('map_id', $mapId);

    if ($mapLayerId === null) {
        $query->whereNull('map_layer_id');
    } else {
        $query->where('map_layer_id', $mapLayerId);
    }

    return $query->orderBy('id', 'asc')->first();
}

    private function hasReincarnationChildren(int $monsterId): bool
    {
        return DB::table('monsters')
            ->where('reincarnation_parent_id', $monsterId)
            ->exists();
    }

   private function syncCreatedSpawnToReincarnations(int $parentMonsterId, array $spawnData): void
{
    $childIds = $this->getReincarnationChildIds($parentMonsterId);

    if (empty($childIds)) {
        return;
    }

    foreach ($childIds as $childMonsterId) {
        $existing = $this->findSpawnByMonsterAndLocation(
            $childMonsterId,
            (int) $spawnData['map_id'],
            $spawnData['map_layer_id'] ?? null
        );

        $payload = [
            'monster_id' => $childMonsterId,
            'map_id' => $spawnData['map_id'],
            'map_layer_id' => $spawnData['map_layer_id'],
            'area' => $spawnData['area'],
            'spawn_time' => $spawnData['spawn_time'],
            'spawn_count' => $spawnData['spawn_count'],
            'symbol_count' => $spawnData['symbol_count'],
            'note' => $spawnData['note'],
            'imported_note' => $spawnData['imported_note'],
            'is_hunting_ground' => $spawnData['is_hunting_ground'],
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('monster_map_spawns')
                ->where('id', $existing->id)
                ->update($payload);
        } else {
            DB::table('monster_map_spawns')->insert($payload + [
                'created_at' => now(),
            ]);
        }
    }
}

private function syncUpdatedSpawnToReincarnations(object $before, array $after): void
{
    $childIds = $this->getReincarnationChildIds((int) $before->monster_id);

    if (empty($childIds)) {
        return;
    }

    foreach ($childIds as $childMonsterId) {
        // 変更前の map_id + map_layer_id で子レコードを特定する
        $childSpawn = $this->findSpawnByMonsterAndLocation(
            $childMonsterId,
            (int) $before->map_id,
            $before->map_layer_id
        );

        if ($childSpawn) {
            DB::table('monster_map_spawns')
                ->where('id', $childSpawn->id)
                ->update([
                    'map_id' => $after['map_id'],
                    'map_layer_id' => $after['map_layer_id'],
                    'area' => $after['area'],
                    'spawn_time' => $after['spawn_time'],
                    'spawn_count' => $after['spawn_count'],
                    'symbol_count' => $after['symbol_count'],
                    'note' => $after['note'],
                    'imported_note' => $after['imported_note'],
                    'is_hunting_ground' => (bool) $after['is_hunting_ground'],
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('monster_map_spawns')->insert([
                'monster_id' => $childMonsterId,
                'map_id' => $after['map_id'],
                'map_layer_id' => $after['map_layer_id'],
                'area' => $after['area'],
                'spawn_time' => $after['spawn_time'] ?? 'normal',
                'spawn_count' => $after['spawn_count'],
                'symbol_count' => $after['symbol_count'],
                'note' => $after['note'],
                'imported_note' => $after['imported_note'],
                'is_hunting_ground' => (bool) $after['is_hunting_ground'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}

    private function syncDeletedSpawnToReincarnations(object $before): void
{
    $childIds = $this->getReincarnationChildIds((int) $before->monster_id);

    if (empty($childIds)) {
        return;
    }

    foreach ($childIds as $childMonsterId) {
        $query = DB::table('monster_map_spawns')
            ->where('monster_id', $childMonsterId)
            ->where('map_id', $before->map_id);

        if ($before->map_layer_id === null) {
            $query->whereNull('map_layer_id');
        } else {
            $query->where('map_layer_id', $before->map_layer_id);
        }

        $query->delete();
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

            if ($this->hasReincarnationChildren($spawnData['monster_id'])) {
                $this->syncCreatedSpawnToReincarnations($spawnData['monster_id'], $spawnData);
            }
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

    DB::table('monster_map_spawns')
        ->where('id', $id)
        ->update($updateData);

    $after = [
        'map_id' => array_key_exists('map_id', $updateData) ? $updateData['map_id'] : $current->map_id,
        'map_layer_id' => array_key_exists('map_layer_id', $updateData) ? $updateData['map_layer_id'] : $current->map_layer_id,
        'area' => array_key_exists('area', $updateData) ? $updateData['area'] : $current->area,
        'spawn_time' => array_key_exists('spawn_time', $updateData) ? $updateData['spawn_time'] : $current->spawn_time,
        'spawn_count' => array_key_exists('spawn_count', $updateData) ? $updateData['spawn_count'] : $current->spawn_count,
        'symbol_count' => array_key_exists('symbol_count', $updateData) ? $updateData['symbol_count'] : $current->symbol_count,
        'note' => array_key_exists('note', $updateData) ? $updateData['note'] : $current->note,
        'imported_note' => array_key_exists('imported_note', $updateData) ? $updateData['imported_note'] : $current->imported_note,
        'is_hunting_ground' => array_key_exists('is_hunting_ground', $updateData)
            ? (bool) $updateData['is_hunting_ground']
            : (bool) $current->is_hunting_ground,
    ];

    $beforeMonsterId = (int) $current->monster_id;

    if ($this->hasReincarnationChildren($beforeMonsterId)) {
        try {
            $this->syncUpdatedSpawnToReincarnations($current, $after);
        } catch (\Throwable $e) {
            \Log::error('reincarnation spawn sync failed', [
                'parent_spawn_id' => $id,
                'parent_monster_id' => $beforeMonsterId,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

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

        DB::transaction(function () use ($current, $id) {
            $monsterId = (int) $current->monster_id;

            if ($this->hasReincarnationChildren($monsterId)) {
                $this->syncDeletedSpawnToReincarnations($current);
            }

            DB::table('monster_map_spawns')
                ->where('id', $id)
                ->delete();
        });

        return response()->json([
            'success' => true,
        ]);
    }
}
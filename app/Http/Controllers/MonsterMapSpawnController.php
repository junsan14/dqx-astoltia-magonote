<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonsterMapSpawnController extends Controller
{
    /**
     * 一覧取得
     * GET /api/monster-map-spawns?monster_id=12
     */
    public function index(Request $request)
    {
        $monsterId = $request->get('monster_id');

        $query = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.note',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'maps.image_path as map_image_url'
            )
            ->orderBy('monster_map_spawns.id', 'asc');

        if ($monsterId !== null && $monsterId !== '') {
            $query->where('monster_map_spawns.monster_id', $monsterId);
        }

        $rows = $query->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    /**
     * 1件取得
     * GET /api/monster-map-spawns/{monster_map_spawn}
     */
    public function show(string $id)
    {
        $row = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->where('monster_map_spawns.id', $id)
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.note',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'maps.image_path as map_image_url'
            )
            ->first();

        if (!$row) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        return response()->json([
            'data' => $row,
        ]);
    }

    /**
     * 作成
     * POST /api/monster-map-spawns
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'monster_id' => ['required', 'integer'],
            'map_id' => ['required', 'integer'],
            'area' => ['nullable', 'string'],
            'spawn_time' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
        ]);

        $id = DB::table('monster_map_spawns')->insertGetId([
            'monster_id' => $data['monster_id'],
            'map_id' => $data['map_id'],
            'area' => $data['area'] ?? null,
            'spawn_time' => $data['spawn_time'] ?? 'normal',
            'note' => $data['note'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->where('monster_map_spawns.id', $id)
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.note',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'maps.image_path as map_image_url'
            )
            ->first();

        return response()->json([
            'data' => $row,
        ], 201);
    }

    /**
     * 更新
     * PUT /api/monster-map-spawns/{monster_map_spawn}
     */
    public function update(Request $request, string $id)
    {
        $exists = DB::table('monster_map_spawns')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => '生息地が見つからない',
            ], 404);
        }

        $data = $request->validate([
            'monster_id' => ['sometimes', 'required', 'integer'],
            'map_id' => ['sometimes', 'required', 'integer'],
            'area' => ['nullable', 'string'],
            'spawn_time' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
        ]);

        $updateData = [
            'updated_at' => now(),
        ];

        if (array_key_exists('monster_id', $data)) {
            $updateData['monster_id'] = $data['monster_id'];
        }

        if (array_key_exists('map_id', $data)) {
            $updateData['map_id'] = $data['map_id'];
        }

        if (array_key_exists('area', $data)) {
            $updateData['area'] = $data['area'];
        }

        if (array_key_exists('spawn_time', $data)) {
            $updateData['spawn_time'] = $data['spawn_time'] ?: 'normal';
        }

        if (array_key_exists('note', $data)) {
            $updateData['note'] = $data['note'];
        }

        DB::table('monster_map_spawns')
            ->where('id', $id)
            ->update($updateData);

        $row = DB::table('monster_map_spawns')
            ->leftJoin('maps', 'monster_map_spawns.map_id', '=', 'maps.id')
            ->where('monster_map_spawns.id', $id)
            ->select(
                'monster_map_spawns.id',
                'monster_map_spawns.monster_id',
                'monster_map_spawns.map_id',
                'monster_map_spawns.area',
                'monster_map_spawns.spawn_time',
                'monster_map_spawns.note',
                'monster_map_spawns.created_at',
                'monster_map_spawns.updated_at',
                'maps.name as map_name',
                'maps.image_path as map_image_url'
            )
            ->first();

        return response()->json([
            'data' => $row,
        ]);
    }

    /**
     * 削除
     * DELETE /api/monster-map-spawns/{monster_map_spawn}
     */
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
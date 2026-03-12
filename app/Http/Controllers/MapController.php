<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MapController extends Controller
{
    /**
     * 一覧取得
     * GET /api/maps
     * GET /api/maps?q=ジュレット
     */
    public function index(Request $request)
    {
        $keyword = trim((string) $request->get('q', ''));

        $query = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'image_path',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->orderBy('id', 'asc');

        if ($keyword !== '') {
            $query->where(function ($sub) use ($keyword) {
                $sub->where('name', 'like', "%{$keyword}%")
                    ->orWhere('continent', 'like', "%{$keyword}%")
                    ->orWhere('map_type', 'like', "%{$keyword}%");
            });
        }

        $rows = $query->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    /**
     * 1件取得
     * GET /api/maps/{map}
     */
    public function show(string $id)
    {
        $row = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'image_path',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->where('id', $id)
            ->first();

        if (!$row) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        return response()->json([
            'data' => $row,
        ]);
    }

    /**
     * 作成
     * POST /api/maps
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'continent' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'map_type' => ['required', 'string', 'max:255'],
            'source_url' => ['nullable', 'string', 'max:255'],
        ]);

        $id = DB::table('maps')->insertGetId([
            'continent' => $data['continent'],
            'name' => $data['name'],
            'image_path' => $data['image_path'] ?? null,
            'map_type' => $data['map_type'],
            'source_url' => $data['source_url'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'image_path',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $row,
        ], 201);
    }

    /**
     * 更新
     * PUT /api/maps/{map}
     */
    public function update(Request $request, string $id)
    {
        $exists = DB::table('maps')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        $data = $request->validate([
            'continent' => ['sometimes', 'required', 'string', 'max:255'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'map_type' => ['sometimes', 'required', 'string', 'max:255'],
            'source_url' => ['nullable', 'string', 'max:255'],
        ]);

        $updateData = [
            'updated_at' => now(),
        ];

        if (array_key_exists('continent', $data)) {
            $updateData['continent'] = $data['continent'];
        }

        if (array_key_exists('name', $data)) {
            $updateData['name'] = $data['name'];
        }

        if (array_key_exists('image_path', $data)) {
            $updateData['image_path'] = $data['image_path'];
        }

        if (array_key_exists('map_type', $data)) {
            $updateData['map_type'] = $data['map_type'];
        }

        if (array_key_exists('source_url', $data)) {
            $updateData['source_url'] = $data['source_url'];
        }

        DB::table('maps')
            ->where('id', $id)
            ->update($updateData);

        $row = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'image_path',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $row,
        ]);
    }

    /**
     * 削除
     * DELETE /api/maps/{map}
     */
    public function destroy(string $id)
    {
        $exists = DB::table('maps')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        DB::table('maps')->where('id', $id)->delete();

        return response()->json([
            'success' => true,
        ]);
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GameJobController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $query = DB::table('game_jobs')
            ->select([
                'id',
                'key',
                'name',
                'created_at',
                'updated_at',
            ])
            ->orderBy('id');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('key', 'like', "%{$q}%");
            });
        }

        $rows = $query->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function show($id)
    {
        $row = DB::table('game_jobs')
            ->select([
                'id',
                'key',
                'name',
                'created_at',
                'updated_at',
            ])
            ->where('id', $id)
            ->first();

        if (!$row) {
            return response()->json([
                'message' => '職業が見つからない',
            ], 404);
        }

        return response()->json([
            'data' => $row,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                'max:255',
                'unique:game_jobs,key',
            ],
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:game_jobs,name',
            ],
        ], [
            'key.required' => 'key は必須',
            'key.unique' => 'その key はすでに存在する',
            'name.required' => 'name は必須',
            'name.unique' => 'その職業名はすでに存在する',
        ]);

        $id = DB::table('game_jobs')->insertGetId([
            'key' => $validated['key'],
            'name' => $validated['name'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('game_jobs')
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $row,
            'message' => '職業を作成した',
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $exists = DB::table('game_jobs')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => '職業が見つからない',
            ], 404);
        }

        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                'max:255',
                Rule::unique('game_jobs', 'key')->ignore($id),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('game_jobs', 'name')->ignore($id),
            ],
        ], [
            'key.required' => 'key は必須',
            'key.unique' => 'その key はすでに存在する',
            'name.required' => 'name は必須',
            'name.unique' => 'その職業名はすでに存在する',
        ]);

        DB::table('game_jobs')
            ->where('id', $id)
            ->update([
                'key' => $validated['key'],
                'name' => $validated['name'],
                'updated_at' => now(),
            ]);

        $row = DB::table('game_jobs')
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $row,
            'message' => '職業を更新した',
        ]);
    }

    public function destroy($id)
    {
        $row = DB::table('game_jobs')->where('id', $id)->first();

        if (!$row) {
            return response()->json([
                'message' => '職業が見つからない',
            ], 404);
        }

        DB::table('game_jobs')->where('id', $id)->delete();

        return response()->json([
            'message' => '職業を削除した',
        ]);
    }
    public function updateEquipableTypes(Request $request, $id)
{
    $job = DB::table('game_jobs')->where('id', $id)->first();

    if (!$job) {
        return response()->json([
            'message' => '職業が見つからない',
        ], 404);
    }

    $validated = $request->validate([
        'equipment_type_ids' => [
            'nullable',
            'array',
        ],
        'equipment_type_ids.*' => [
            'integer',
            'exists:equipment_types,id',
        ],
    ], [
        'equipment_type_ids.array' => 'equipment_type_ids は配列で指定してください',
        'equipment_type_ids.*.integer' => '装備タイプIDは整数で指定してください',
        'equipment_type_ids.*.exists' => '存在しない装備タイプIDが含まれています',
    ]);

    $equipmentTypeIds = collect($validated['equipment_type_ids'] ?? [])
        ->map(fn ($id) => (int) $id)
        ->filter(fn ($id) => $id > 0)
        ->unique()
        ->values()
        ->all();

    DB::transaction(function () use ($id, $equipmentTypeIds) {
        DB::table('equipable_types')
            ->where('game_job_id', $id)
            ->delete();

        $now = now();

        $rows = collect($equipmentTypeIds)->map(function ($equipmentTypeId) use ($id, $now) {
            return [
                'game_job_id' => $id,
                'equipment_type_id' => $equipmentTypeId,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->all();

        if (!empty($rows)) {
            DB::table('equipable_types')->insert($rows);
        }
    });

    return response()->json([
        'message' => '装備可能タイプを更新した',
        'data' => [
            'game_job_id' => (int) $id,
            'equipment_type_ids' => $equipmentTypeIds,
        ],
    ]);
}
}
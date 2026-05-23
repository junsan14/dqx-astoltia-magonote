<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EquipmentType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EquipmentTypeController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $types = EquipmentType::with([
            'craftType',
            'equipableTypes.gameJob',
        ])
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($subQuery) use ($q) {
                    $subQuery
                        ->where('name', 'like', "%{$q}%")
                        ->orWhere('key', 'like', "%{$q}%")
                        ->orWhere('kind', 'like', "%{$q}%")
                        ->orWhereHas('craftType', function ($craftQuery) use ($q) {
                            $craftQuery
                                ->where('name', 'like', "%{$q}%")
                                ->orWhere('key', 'like', "%{$q}%");
                        });
                });
            })
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $types,
        ]);
    }

    public function show(EquipmentType $equipmentType)
    {
        $equipmentType->load([
            'craftType',
            'equipableTypes.gameJob',
        ]);

        return response()->json([
            'data' => $equipmentType,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                'max:255',
                Rule::unique('equipment_types', 'key'),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'kind' => [
                'required',
                Rule::in(['weapon', 'armor']),
            ],
            'craft_type_id' => [
                'nullable',
                'integer',
                'exists:craft_types,id',
            ],
        ]);

        $equipmentType = EquipmentType::create($validated);

        $equipmentType->load([
            'craftType',
            'equipableTypes.gameJob',
        ]);

        return response()->json([
            'data' => $equipmentType,
        ], 201);
    }

    public function update(Request $request, EquipmentType $equipmentType)
    {
        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                'max:255',
                Rule::unique('equipment_types', 'key')->ignore($equipmentType->id),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'kind' => [
                'required',
                Rule::in(['weapon', 'armor']),
            ],
            'craft_type_id' => [
                'nullable',
                'integer',
                'exists:craft_types,id',
            ],
        ]);

        $equipmentType->fill($validated);
        $equipmentType->save();

        $equipmentType->load([
            'craftType',
            'equipableTypes.gameJob',
        ]);

        return response()->json([
            'data' => $equipmentType,
        ]);
    }

    public function destroy(EquipmentType $equipmentType)
    {
        $name = $equipmentType->name;

        $equipmentType->delete();

        return response()->json([
            'message' => "「{$name}」を削除した",
        ]);
    }
}
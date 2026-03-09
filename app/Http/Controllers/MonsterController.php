<?php

namespace App\Http\Controllers;

use App\Models\Monster;
use Illuminate\Http\Request;

class MonsterController extends Controller
{
    public function index(Request $request)
    {
        $keyword = $request->keyword;

        $monsters = Monster::query()
            ->when($keyword, function ($query) use ($keyword) {
                $query->where('name', 'like', "%{$keyword}%");
            })
            ->select('id', 'name', 'normal_drop', 'rare_drop')
            ->limit(50)
            ->get();

        return response()->json($monsters);
    }

    public function show($id)
    {
        $monster = Monster::with(['spawns.map'])->findOrFail($id);

        $groupedMaps = $monster->spawns
            ->filter(fn ($spawn) => $spawn->map)
            ->groupBy('map_id')
            ->map(function ($spawns) {
                $map = $spawns->first()->map;

                return [
                    'id' => $map->id,
                    'name' => $map->name,
                    'image_path' => $map->image_path,
                    'spawns' => $spawns->map(function ($spawn) {
                        return [
                            'id' => $spawn->id,
                            'area' => $spawn->area,
                            'spawn_count' => $spawn->spawn_count,
                        ];
                    })->values(),
                ];
            })
            ->values();

        return response()->json([
            'id' => $monster->id,
            'name' => $monster->name,
            'normal_drop' => $monster->normal_drop,
            'rare_drop' => $monster->rare_drop,
            'maps' => $groupedMaps,
        ]);
    }
}
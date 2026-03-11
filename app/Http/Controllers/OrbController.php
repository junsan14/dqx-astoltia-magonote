<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrbRequest;
use App\Http\Requests\UpdateOrbRequest;
use App\Models\Monster;
use App\Models\MonsterDrop;
use App\Models\Orb;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrbController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $query = Orb::query()->orderBy('id', 'desc');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('color', 'like', "%{$q}%")
                    ->orWhere('effect', 'like', "%{$q}%");
            });
        }

        $orbs = $query->paginate(100);

        return response()->json([
            'data' => $orbs,
        ]);
    }

    public function show(Orb $orb): JsonResponse
    {
        $drops = MonsterDrop::query()
            ->where('drop_target_type', 'orb')
            ->where('drop_target_id', $orb->id)
            ->orderByRaw('sort_order is null, sort_order asc')
            ->get();

        $monsterIds = $drops->pluck('monster_id')->filter()->values()->all();

        $monstersById = Monster::query()
            ->whereIn('id', $monsterIds)
            ->get()
            ->keyBy('id');

        $dropMonsters = $drops->map(function ($drop) use ($monstersById) {
            $monster = $monstersById->get($drop->monster_id);

            return [
                'id' => $drop->id,
                'monster_id' => $drop->monster_id,
                'drop_type' => $drop->drop_type,
                'sort_order' => $drop->sort_order,
                'monster' => $monster ? [
                    'id' => $monster->id,
                    'monster_no' => $monster->monster_no,
                    'name' => $monster->name,
                    'system_type' => $monster->system_type,
                ] : null,
            ];
        })->values();

        return response()->json([
            'data' => [
                'id' => $orb->id,
                'name' => $orb->name,
                'color' => $orb->color,
                'effect' => $orb->effect,
                'drop_monsters' => $dropMonsters,
            ],
        ]);
    }

  public function store(StoreOrbRequest $request): JsonResponse
{
    $validated = $request->validated();

    logger()->info('orb store validated', $validated);

    $orb = DB::transaction(function () use ($validated) {
        $orb = Orb::create([
            'name' => $validated['name'],
            'color' => $validated['color'] ?? null,
            'effect' => $validated['effect'] ?? null,
        ]);

        $this->syncDropMonsters($orb->id, $validated['drop_monsters'] ?? []);

        return $orb;
    });

    return response()->json([
        'message' => 'オーブを作成した',
        'data' => $this->buildOrbResponse($orb->fresh()),
    ], 201);
}

    public function update(UpdateOrbRequest $request, Orb $orb): JsonResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($orb, $validated) {
            $orb->update([
                'name' => $validated['name'],
                'color' => $validated['color'] ?? null,
                'effect' => $validated['effect'] ?? null,
            ]);

            $this->syncDropMonsters($orb->id, $validated['drop_monsters'] ?? []);
        });

        return response()->json([
            'message' => 'オーブを更新した',
            'data' => $this->buildOrbResponse($orb->fresh()),
        ]);
    }

    public function destroy(Orb $orb): JsonResponse
    {
        DB::transaction(function () use ($orb) {
            MonsterDrop::query()
                ->where('drop_target_type', 'orb')
                ->where('drop_target_id', $orb->id)
                ->delete();

            $orb->delete();
        });

        return response()->json([
            'message' => 'オーブを削除した',
        ]);
    }

    private function syncDropMonsters(int $orbId, array $dropMonsters): void
    {
        MonsterDrop::query()
            ->where('drop_target_type', 'orb')
            ->where('drop_target_id', $orbId)
            ->delete();

        foreach (array_values($dropMonsters) as $index => $row) {
            $monsterId = (int) ($row['monster_id'] ?? 0);
            if (!$monsterId) {
                continue;
            }

            MonsterDrop::create([
                'monster_id' => $monsterId,
                'drop_target_type' => 'orb',
                'drop_target_id' => $orbId,
                'drop_type' => $row['drop_type'] ?? 'normal',
                'sort_order' => $row['sort_order'] ?? ($index + 1),
            ]);
        }
    }

    private function buildOrbResponse(Orb $orb): array
    {
        $drops = MonsterDrop::query()
            ->where('drop_target_type', 'orb')
            ->where('drop_target_id', $orb->id)
            ->orderByRaw('sort_order is null, sort_order asc')
            ->get();

        $monsterIds = $drops->pluck('monster_id')->filter()->values()->all();

        $monstersById = Monster::query()
            ->whereIn('id', $monsterIds)
            ->get()
            ->keyBy('id');

        return [
            'id' => $orb->id,
            'name' => $orb->name,
            'color' => $orb->color,
            'effect' => $orb->effect,
            'drop_monsters' => $drops->map(function ($drop) use ($monstersById) {
                $monster = $monstersById->get($drop->monster_id);

                return [
                    'id' => $drop->id,
                    'monster_id' => $drop->monster_id,
                    'drop_type' => $drop->drop_type,
                    'sort_order' => $drop->sort_order,
                    'monster' => $monster ? [
                        'id' => $monster->id,
                        'monster_no' => $monster->monster_no,
                        'name' => $monster->name,
                        'system_type' => $monster->system_type,
                    ] : null,
                ];
            })->values(),
        ];
    }
}
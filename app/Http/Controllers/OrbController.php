<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrbRequest;
use App\Http\Requests\UpdateOrbRequest;
use App\Models\Monster;
use App\Models\MonsterDrop;
use App\Models\Orb;
use App\Services\MonsterDropSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrbController extends Controller
{
    public function __construct(
        private MonsterDropSyncService $monsterDropSyncService
    ) {}

 public function index(Request $request): JsonResponse
{
    $q = trim((string) $request->query('q', ''));
    $color = trim((string) $request->query('color', ''));

    $query = Orb::query();

    if ($color !== '') {
        $query->where('color', $color);
    }

    if ($q !== '') {
        $escaped = addcslashes($q, '\\%_');

        $query->where(function ($sub) use ($escaped) {
            $sub->where('name', 'like', "%{$escaped}%")
                ->orWhere('color', 'like', "%{$escaped}%")
                ->orWhere('effect', 'like', "%{$escaped}%");
        })
        ->orderByRaw(
            "
            CASE
                WHEN name = ? THEN 0
                WHEN name LIKE ? THEN 1
                ELSE 2
            END
            ",
            [$q, $escaped . '%']
        )
        ->orderByRaw('LENGTH(name) ASC')
        ->orderBy('name');
    } else {
        $query->orderBy('name');
    }

    return response()->json([
        'data' => $query->get(),
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

            $this->monsterDropSyncService->sync(
                'orb',
                $orb->id,
                $validated['drop_monsters'] ?? []
            );

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
         logger()->info('orb store validated', $validated);
        DB::transaction(function () use ($orb, $validated) {
            $orb->update([
                'name' => $validated['name'],
                'color' => $validated['color'] ?? null,
                'effect' => $validated['effect'] ?? null,
            ]);

            $this->monsterDropSyncService->sync(
                'orb',
                $orb->id,
                $validated['drop_monsters'] ?? []
            );
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
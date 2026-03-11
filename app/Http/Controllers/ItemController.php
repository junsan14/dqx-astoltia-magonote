<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItemRequest;
use App\Http\Requests\UpdateItemRequest;
use App\Models\Item;
use App\Models\Monster;
use App\Models\MonsterDrop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $query = Item::query()->orderBy('id', 'desc');

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('category', 'like', "%{$q}%");
            });
        }

        $items = $query->paginate(100);

        return response()->json([
            'data' => $items,
        ]);
    }

    public function show(Item $item): JsonResponse
    {
        return response()->json([
            'data' => $this->buildItemResponse($item),
        ]);
    }

    public function store(StoreItemRequest $request): JsonResponse
    {
        $validated = $request->validated();

        logger()->info('item store validated', $validated);

        $item = DB::transaction(function () use ($validated) {
            $item = Item::create([
                'name' => $validated['name'],
                'buy_price' => $validated['buy_price'] ?? null,
                'sell_price' => $validated['sell_price'] ?? null,
                'category' => $validated['category'] ?? null,
            ]);

            $this->syncDropMonsters($item->id, $validated['drop_monsters'] ?? []);

            return $item;
        });

        return response()->json([
            'message' => 'アイテムを作成した',
            'data' => $this->buildItemResponse($item->fresh()),
        ], 201);
    }

    public function update(UpdateItemRequest $request, Item $item): JsonResponse
    {
        $validated = $request->validated();

        logger()->info('item update validated', $validated);

        DB::transaction(function () use ($item, $validated) {
            $item->update([
                'name' => $validated['name'],
                'buy_price' => $validated['buy_price'] ?? null,
                'sell_price' => $validated['sell_price'] ?? null,
                'category' => $validated['category'] ?? null,
            ]);

            $this->syncDropMonsters($item->id, $validated['drop_monsters'] ?? []);
        });

        return response()->json([
            'message' => 'アイテムを更新した',
            'data' => $this->buildItemResponse($item->fresh()),
        ]);
    }

    public function destroy(Item $item): JsonResponse
    {
        DB::transaction(function () use ($item) {
            MonsterDrop::query()
                ->where('drop_target_type', 'item')
                ->where('drop_target_id', $item->id)
                ->delete();

            $item->delete();
        });

        return response()->json([
            'message' => 'アイテムを削除した',
        ]);
    }

    private function syncDropMonsters(int $itemId, array $dropMonsters): void
{
    MonsterDrop::query()
        ->where('drop_target_type', 'item')
        ->where('drop_target_id', $itemId)
        ->delete();

    foreach (array_values($dropMonsters) as $index => $row) {
        $monsterId = (int) ($row['monster_id'] ?? 0);

        if ($monsterId <= 0) {
            continue;
        }

        MonsterDrop::create([
            'monster_id' => $monsterId,
            'drop_target_type' => 'item',
            'drop_target_id' => $itemId,
            'drop_type' => $row['drop_type'] ?? 'normal',
            'sort_order' => isset($row['sort_order']) ? (int) $row['sort_order'] : ($index + 1),
        ]);
    }
}

    private function buildItemResponse(Item $item): array
    {
        $drops = MonsterDrop::query()
            ->where('drop_target_type', 'item')
            ->where('drop_target_id', $item->id)
            ->orderByRaw('sort_order is null, sort_order asc')
            ->get();

        $monsterIds = $drops->pluck('monster_id')->filter()->values()->all();

        $monstersById = Monster::query()
            ->whereIn('id', $monsterIds)
            ->get()
            ->keyBy('id');

        return [
            'id' => $item->id,
            'name' => $item->name,
            'buy_price' => $item->buy_price,
            'sell_price' => $item->sell_price,
            'category' => $item->category,
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
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Boss;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BossController extends Controller
{
    public function index()
    {
        $bosses = Boss::query()
            ->with(['stats', 'pushWeights'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $bosses,
        ]);
    }

    public function show(Boss $boss)
    {
        $boss->load(['stats', 'pushWeights']);

        return response()->json([
            'data' => $boss,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateBossPayload($request);

        $boss = DB::transaction(function () use ($validated) {
            $boss = Boss::create($this->bossBaseData($validated));

            $this->replaceStats($boss, $validated['stats'] ?? []);
            $this->replacePushWeights($boss, $validated['push_weights'] ?? []);

            return $boss;
        });

        $boss->load(['stats', 'pushWeights']);

        return response()->json([
            'data' => $boss,
            'message' => 'ボスを作成した',
        ], 201);
    }

    public function update(Request $request, Boss $boss)
    {
        $validated = $this->validateBossPayload($request, $boss->id);

        DB::transaction(function () use ($boss, $validated) {
            $boss->update($this->bossBaseData($validated));

            $this->replaceStats($boss, $validated['stats'] ?? []);
            $this->replacePushWeights($boss, $validated['push_weights'] ?? []);
        });

        $boss->refresh();
        $boss->load(['stats', 'pushWeights']);

        return response()->json([
            'data' => $boss,
            'message' => 'ボスを更新した',
        ]);
    }

    public function destroy(Boss $boss)
    {
        DB::transaction(function () use ($boss) {
            DB::table('boss_stats')->where('boss_id', $boss->id)->delete();
            DB::table('boss_push_weights')->where('boss_id', $boss->id)->delete();

            $boss->delete();
        });

        return response()->json([
            'message' => 'ボスを削除した',
        ]);
    }

    public function weightCheckerBosses()
    {
        $bosses = Boss::query()
            ->where('is_active', true)
            ->whereHas('pushWeights')
            ->with(['stats', 'pushWeights'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $bosses,
        ]);
    }

    private function validateBossPayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'boss_id' => [
                'required',
                'string',
                'max:255',
                Rule::unique('bosses', 'boss_id')->ignore($ignoreId),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'name_en' => [
                'nullable',
                'string',
                'max:255',
            ],
            'category' => [
                'nullable',
                'string',
                'max:255',
            ],
            'series' => [
                'nullable',
                'string',
                'max:255',
            ],
            'race' => [
                'nullable',
                'string',
                'max:255',
            ],
            'image_url' => [
                'nullable',
                'string',
                'max:255',
            ],
            'source_url' => [
                'nullable',
                'string',
                'max:255',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'note' => [
                'nullable',
                'string',
            ],
            'is_active' => [
                'boolean',
            ],
            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],

            'stats' => [
                'nullable',
                'array',
            ],
            'stats.*.id' => [
                'nullable',
                'integer',
            ],
            'stats.*.variant' => [
                'nullable',
                'string',
                'max:255',
            ],
            'stats.*.level' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.hp' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.mp' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.attack' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.defense' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.magic_attack' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.magic_defense' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.agility' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'stats.*.extra_stats_json' => [
                'nullable',
                'array',
            ],
            'stats.*.note' => [
                'nullable',
                'string',
            ],

            'push_weights' => [
                'nullable',
                'array',
            ],
            'push_weights.*.id' => [
                'nullable',
                'integer',
            ],
            'push_weights.*.variant' => [
                'nullable',
                'string',
                'max:255',
            ],
            'push_weights.*.disadvantage_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.equal_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.win_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.complete_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.wb_disadvantage_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.wb_equal_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.wb_win_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.wb_complete_weight' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'push_weights.*.note' => [
                'nullable',
                'string',
            ],
        ], [
            'boss_id.required' => 'boss_id は必須',
            'boss_id.unique' => 'その boss_id はすでに存在する',
            'name.required' => 'name は必須',
        ]);
    }

    private function bossBaseData(array $validated): array
    {
        return [
            'boss_id' => $validated['boss_id'],
            'name' => $validated['name'],
            'name_en' => $validated['name_en'] ?? null,
            'category' => $validated['category'] ?? null,
            'series' => $validated['series'] ?? null,
            'race' => $validated['race'] ?? null,
            'image_url' => $validated['image_url'] ?? null,
            'source_url' => $validated['source_url'] ?? null,
            'description' => $validated['description'] ?? null,
            'note' => $validated['note'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
        ];
    }

    private function replaceStats(Boss $boss, array $stats): void
    {
        DB::table('boss_stats')->where('boss_id', $boss->id)->delete();

        $now = now();

        $rows = collect($stats)
            ->map(function ($stat) use ($boss, $now) {
                return [
                    'boss_id' => $boss->id,
                    'variant' => $stat['variant'] ?? null,
                    'level' => $stat['level'] ?? null,
                    'hp' => $stat['hp'] ?? null,
                    'mp' => $stat['mp'] ?? null,
                    'attack' => $stat['attack'] ?? null,
                    'defense' => $stat['defense'] ?? null,
                    'magic_attack' => $stat['magic_attack'] ?? null,
                    'magic_defense' => $stat['magic_defense'] ?? null,
                    'agility' => $stat['agility'] ?? null,
                    'weight' => $stat['weight'] ?? null,
                    'extra_stats_json' => isset($stat['extra_stats_json'])
                        ? json_encode($stat['extra_stats_json'], JSON_UNESCAPED_UNICODE)
                        : null,
                    'note' => $stat['note'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })
            ->all();

        if (!empty($rows)) {
            DB::table('boss_stats')->insert($rows);
        }
    }

    private function replacePushWeights(Boss $boss, array $pushWeights): void
    {
        DB::table('boss_push_weights')->where('boss_id', $boss->id)->delete();

        $now = now();

        $rows = collect($pushWeights)
            ->map(function ($push) use ($boss, $now) {
                return [
                    'boss_id' => $boss->id,
                    'variant' => $push['variant'] ?? null,
                    'disadvantage_weight' => $push['disadvantage_weight'] ?? null,
                    'equal_weight' => $push['equal_weight'] ?? null,
                    'win_weight' => $push['win_weight'] ?? null,
                    'complete_weight' => $push['complete_weight'] ?? null,
                    'wb_disadvantage_weight' => $push['wb_disadvantage_weight'] ?? null,
                    'wb_equal_weight' => $push['wb_equal_weight'] ?? null,
                    'wb_win_weight' => $push['wb_win_weight'] ?? null,
                    'wb_complete_weight' => $push['wb_complete_weight'] ?? null,
                    'note' => $push['note'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })
            ->all();

        if (!empty($rows)) {
            DB::table('boss_push_weights')->insert($rows);
        }
    }
}
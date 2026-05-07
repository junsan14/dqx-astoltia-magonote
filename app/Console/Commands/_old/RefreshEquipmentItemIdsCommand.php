<?php

namespace App\Console\Commands;

use App\Models\Equipment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefreshEquipmentItemIdsCommand extends Command
{
    protected $signature = 'equipments:refresh-item-ids
        {--dry-run : Check only, do not update}
        {--limit= : Limit number of rows for preview/output}';

    protected $description = 'Refresh equipments.item_id using equipment type key and equip level.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;

        $this->info('Refreshing equipment item_id...');
        $this->line('Rule:');
        $this->line('- Weapon: {equipment_type.key}_{equip_level}');
        $this->line('- Shield: shield_small_{equip_level} / shield_large_{equip_level}');
        $this->line('- Armor: bougu_{equip_level}_{set_no}_{slot}');
        $this->newLine();

        $rows = Equipment::query()
            ->with('equipmentType')
            ->whereNotNull('equipment_type_id')
            ->whereNotNull('equip_level')
            ->orderBy('id')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('No equipments found.');
            return self::SUCCESS;
        }

        $usedItemIds = [];
        $armorSetNumbers = [];
        $changes = [];

        foreach ($rows as $equipment) {
            $equipmentType = $equipment->equipmentType;

            if (!$equipmentType) {
                continue;
            }

            $oldItemId = (string) ($equipment->item_id ?? '');
            $newItemId = $this->makeItemId(
                equipment: $equipment,
                equipmentType: $equipmentType,
                usedItemIds: $usedItemIds,
                armorSetNumbers: $armorSetNumbers
            );

            if ($newItemId === '') {
                continue;
            }

            $usedItemIds[$newItemId] = true;

            $changes[] = [
                'id' => $equipment->id,
                'name' => $equipment->item_name,
                'old' => $oldItemId,
                'new' => $newItemId,
            ];
        }

        $changedRows = array_values(array_filter($changes, function ($row) {
            return $row['old'] !== $row['new'];
        }));

        $this->info('Target rows: ' . count($rows));
        $this->info('Changed rows: ' . count($changedRows));
        $this->newLine();

        $previewRows = $limit ? array_slice($changedRows, 0, $limit) : array_slice($changedRows, 0, 30);

        if (!empty($previewRows)) {
            $this->table(
                ['id', 'item_name', 'old_item_id', 'new_item_id'],
                array_map(function ($row) {
                    return [
                        $row['id'],
                        $row['name'],
                        $row['old'],
                        $row['new'],
                    ];
                }, $previewRows)
            );
        }

        if ($dryRun) {
            $this->warn('Dry run mode. No data was updated.');
            return self::SUCCESS;
        }

        if (empty($changedRows)) {
            $this->info('No changes needed.');
            return self::SUCCESS;
        }

        DB::beginTransaction();

        try {
            // unique制約対策。先に一時IDへ逃がす。
            foreach ($changes as $row) {
                DB::table('equipments')
                    ->where('id', $row['id'])
                    ->update([
                        'item_id' => '__tmp_equipment_' . $row['id'],
                        'updated_at' => now(),
                    ]);
            }

            foreach ($changes as $row) {
                DB::table('equipments')
                    ->where('id', $row['id'])
                    ->update([
                        'item_id' => $row['new'],
                        'updated_at' => now(),
                    ]);
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->info('item_id refresh completed.');

        $duplicates = DB::table('equipments')
            ->select('item_id', DB::raw('COUNT(*) as count'))
            ->whereNotNull('item_id')
            ->where('item_id', '<>', '')
            ->groupBy('item_id')
            ->havingRaw('COUNT(*) > 1')
            ->orderByDesc('count')
            ->get();

        if ($duplicates->isNotEmpty()) {
            $this->error('Duplicate item_id found after update.');

            $this->table(
                ['item_id', 'count'],
                $duplicates->map(fn ($row) => [
                    $row->item_id,
                    $row->count,
                ])->toArray()
            );

            return self::FAILURE;
        }

        $this->info('No duplicate item_id found.');

        return self::SUCCESS;
    }

    private function makeItemId(
        Equipment $equipment,
        object $equipmentType,
        array $usedItemIds,
        array &$armorSetNumbers
    ): string {
        $typeKey = trim((string) ($equipmentType->key ?? ''));
        $kind = trim((string) ($equipmentType->kind ?? ''));
        $level = $equipment->equip_level ? (int) $equipment->equip_level : null;

        if ($typeKey === '' || !$level) {
            return '';
        }

        if ($this->isNormalArmor($kind, $typeKey)) {
            $setNo = $this->getArmorSetNo($equipment, $armorSetNumbers);
            $slotKey = $this->normalizeSlot($equipment->slot);

            $base = "bougu_{$level}_{$setNo}_{$slotKey}";

            return $this->makeUniqueItemId($base, $usedItemIds);
        }

        $base = "{$typeKey}_{$level}";

        return $this->makeUniqueItemId($base, $usedItemIds);
    }

    private function isNormalArmor(string $kind, string $typeKey): bool
    {
        if ($kind !== 'armor') {
            return false;
        }

        return !in_array($typeKey, ['shield_small', 'shield_large'], true);
    }

    private function getArmorSetNo(Equipment $equipment, array &$armorSetNumbers): int
    {
        $level = $equipment->equip_level ? (int) $equipment->equip_level : 0;

        $groupKey = trim((string) ($equipment->group_id ?? ''));

        if ($groupKey === '') {
            $groupKey = 'single_' . $equipment->id;
        }

        $key = "{$level}:{$groupKey}";

        if (isset($armorSetNumbers[$key])) {
            return $armorSetNumbers[$key];
        }

        $existingNumbersForLevel = array_filter(
            $armorSetNumbers,
            fn ($number, $storedKey) => str_starts_with($storedKey, "{$level}:"),
            ARRAY_FILTER_USE_BOTH
        );

        $nextNo = empty($existingNumbersForLevel)
            ? 1
            : max($existingNumbersForLevel) + 1;

        $armorSetNumbers[$key] = $nextNo;

        return $nextNo;
    }

    private function normalizeSlot($slot): string
    {
        $slot = trim((string) $slot);

        return match ($slot) {
            'head', 'あたま', '頭' => 'head',
            'body_top', 'からだ上', '身体上', '体上' => 'body_top',
            'body_bottom', 'からだ下', '身体下', '体下', '体した' => 'body_bottom',
            'arm', 'arms', 'うで', '腕' => 'arm',
            'foot', 'feet', '足', 'あし' => 'foot',
            default => $slot !== '' ? $this->slug($slot) : 'unknown',
        };
    }

    private function makeUniqueItemId(string $base, array $usedItemIds): string
    {
        if (!isset($usedItemIds[$base])) {
            return $base;
        }

        $count = 2;
        $candidate = "{$base}_{$count}";

        while (isset($usedItemIds[$candidate])) {
            $count++;
            $candidate = "{$base}_{$count}";
        }

        return $candidate;
    }

    private function slug(string $value): string
    {
        $value = mb_strtolower($value);
        $value = preg_replace('/[^a-z0-9_]+/u', '_', $value);
        $value = preg_replace('/_+/', '_', $value);
        $value = trim($value, '_');

        return $value ?: 'unknown';
    }
}
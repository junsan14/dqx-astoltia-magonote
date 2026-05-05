<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAccessoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'item_id' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'item_kind' => ['nullable', 'string', 'max:255'],
            'slot' => ['nullable', 'string', 'max:255'],
            'accessory_type' => ['nullable', 'string', 'max:255'],
            'equip_level' => ['nullable', 'integer', 'min:0'],

            'weight' => ['nullable', 'integer', 'min:0'],
            'attack' => ['nullable', 'integer', 'min:0'],
            'defense' => ['nullable', 'integer', 'min:0'],
            'max_hp' => ['nullable', 'integer', 'min:0'],
            'max_mp' => ['nullable', 'integer', 'min:0'],
            'charm' => ['nullable', 'integer', 'min:0'],
            'agility' => ['nullable', 'integer', 'min:0'],
            'dexterity' => ['nullable', 'integer', 'min:0'],
            'magic_attack' => ['nullable', 'integer', 'min:0'],
            'healing_power' => ['nullable', 'integer', 'min:0'],

            'description' => ['nullable', 'string'],
            'effects_json' => ['nullable', 'array'],

            'synthesis_effects_json' => ['nullable', 'array'],
            'synthesis_effects_json.*.text' => ['nullable', 'string'],
            'synthesis_effects_json.*.note' => ['nullable', 'string'],

            'obtain_methods_json' => ['nullable', 'array'],
            'obtain_methods_json.*.text' => ['nullable', 'string'],
            'obtain_methods_json.*.note' => ['nullable', 'string'],

            'image_url' => ['nullable', 'string', 'max:255'],
            'source_url' => ['nullable', 'string', 'max:255'],
            'detail_url' => ['nullable', 'string', 'max:255'],

            'drop_monsters' => ['nullable', 'array'],
            'drop_monsters.*.monster_id' => ['nullable', 'integer'],
            'drop_monsters.*.drop_type' => ['nullable', 'string'],
            'drop_monsters.*.sort_order' => ['nullable', 'integer'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $dropMonsters = $this->input('drop_monsters', []);
        if (!is_array($dropMonsters)) {
            $dropMonsters = [];
        }

        $normalizedDropMonsters = array_map(function ($row, $index) {
            return [
                'monster_id' => isset($row['monster_id']) && $row['monster_id'] !== ''
                    ? (int) $row['monster_id']
                    : null,
                'drop_type' => $row['drop_type'] ?? 'normal',
                'sort_order' => isset($row['sort_order']) && $row['sort_order'] !== ''
                    ? (int) $row['sort_order']
                    : $index + 1,
            ];
        }, $dropMonsters, array_keys($dropMonsters));

        $this->merge([
            'item_kind' => $this->input('item_kind') ?: 'accessory',
            'equip_level' => $this->filled('equip_level') ? (int) $this->input('equip_level') : null,
            'effects_json' => $this->normalizeJsonArrayField('effects_json'),
            'synthesis_effects_json' => $this->normalizeJsonArrayField('synthesis_effects_json'),
            'obtain_methods_json' => $this->normalizeJsonArrayField('obtain_methods_json'),
            'drop_monsters' => $normalizedDropMonsters,
        ]);
    }

    protected function normalizeJsonArrayField(string $key): array
    {
        $value = $this->input($key);

        if (is_array($value)) {
            return array_values($value);
        }

        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? array_values($decoded) : [];
        }

        return [];
    }
}
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
            'name' => ['required', 'string', 'max:255'],
            'kana' => ['nullable', 'string', 'max:255'],
            'slot' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'rarity' => ['nullable', 'integer'],
            'effect_text' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'buy_price' => ['nullable', 'integer'],
            'sell_price' => ['nullable', 'integer'],
            'source_url' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],

            'drop_monsters' => ['nullable', 'array'],
            'drop_monsters.*.monster_id' => ['required', 'integer', 'exists:monsters,id'],
            'drop_monsters.*.drop_type' => ['nullable', 'string', 'max:50'],
            'drop_monsters.*.sort_order' => ['nullable', 'integer'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $dropMonsters = $this->input('drop_monsters', []);

        if (!is_array($dropMonsters)) {
            $dropMonsters = [];
        }

        $normalized = array_map(function ($row, $index) {
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
            'rarity' => $this->filled('rarity') ? (int) $this->input('rarity') : null,
            'buy_price' => $this->filled('buy_price') ? (int) $this->input('buy_price') : null,
            'sell_price' => $this->filled('sell_price') ? (int) $this->input('sell_price') : null,
            'drop_monsters' => $normalized,
        ]);
    }
}
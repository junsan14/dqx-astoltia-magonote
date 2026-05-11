<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAccessoryRequest extends FormRequest
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
            'inheritance_from_accessory_id' => [
                'nullable',
                'integer',
                'exists:accessories,id',
            ],
            'inheritance_type' => [
                'nullable',
                'string',
                'max:255',
            ],
            'inheritance_note' => [
                'nullable',
                'string',
            ],
        ];
    }
}
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
            'item_kind' => ['nullable', 'string', 'max:255'],
            'slot' => ['nullable', 'string', 'max:255'],
            'accessory_type' => ['nullable', 'string', 'max:255'],
            'equip_level' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'effects_json' => ['nullable', 'array'],
            'synthesis_effects_json' => ['nullable', 'array'],
            'obtain_methods_json' => ['nullable', 'array'],
            'image_url' => ['nullable', 'string', 'max:1000'],
            'source_url' => ['nullable', 'string', 'max:1000'],
            'detail_url' => ['nullable', 'string', 'max:1000'],

            'drop_monsters' => ['nullable', 'array'],
            'drop_monsters.*.id' => ['nullable', 'integer'],
            'drop_monsters.*.monster_id' => ['required', 'integer', 'exists:monsters,id'],
            'drop_monsters.*.drop_type' => ['nullable', 'string', 'max:50'],
            'drop_monsters.*.sort_order' => ['nullable', 'integer'],
        ];
    }
}
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrbRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'color' => ['nullable', 'string', 'max:255'],
            'effect' => ['nullable', 'string'],

            'drop_monsters' => ['nullable', 'array'],
            'drop_monsters.*.monster_id' => ['required', 'integer', 'exists:monsters,id'],
            'drop_monsters.*.drop_type' => ['nullable', 'string', 'max:50'],
            
            'drop_monsters.*.sort_order' => ['nullable', 'integer'],
        ];
    }
}
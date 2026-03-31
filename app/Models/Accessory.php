<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Accessory extends Model
{
    protected $fillable = [
        'item_id',
        'name',
        'name_en',
        'item_kind',
        'slot',
        'accessory_type',
        'equip_level',
        'description',
        'effects_json',
        'synthesis_effects_json',
        'obtain_methods_json',
        'image_url',
        'source_url',
        'detail_url',
    ];

    protected $casts = [
        'effects_json' => 'array',
        'synthesis_effects_json' => 'array',
        'obtain_methods_json' => 'array',
        'equip_level' => 'integer',
    ];


}
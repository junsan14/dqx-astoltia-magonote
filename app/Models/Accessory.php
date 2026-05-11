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
        'weight',
        'attack',
        'defense',
        'max_hp',
        'max_mp',
        'charm',
        'agility',
        'dexterity',
        'magic_attack',
        'healing_power',
        'description',
        'effects_json',
        'synthesis_effects_json',
        'obtain_methods_json',
        'image_url',
        'source_url',
        'detail_url',
        'inheritance_from_accessory_id',
        'inheritance_type',
        'inheritance_note',
    ];

    protected $casts = [
        'effects_json' => 'array',
        'synthesis_effects_json' => 'array',
        'obtain_methods_json' => 'array',
        'equip_level' => 'integer',
        'weight' => 'integer',
        'attack' => 'integer',
        'defense' => 'integer',
        'max_hp' => 'integer',
        'max_mp' => 'integer',
        'charm' => 'integer',
        'agility' => 'integer',
        'dexterity' => 'integer',
        'magic_attack' => 'integer',
        'healing_power' => 'integer',
    ];
    public function inheritanceFrom()
    {
        return $this->belongsTo(
            Accessory::class,
            'inheritance_from_accessory_id'
        );
    }

    public function inheritanceTo()
    {
        return $this->hasMany(
            Accessory::class,
            'inheritance_from_accessory_id'
        );
    }


}
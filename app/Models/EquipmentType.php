<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EquipmentType extends Model
{
    protected $table = 'equipment_types';

    protected $fillable = [
        'key',
        'name',
        'kind',
        'craft_type_id',
    ];

    public function equipments(): HasMany
    {
        return $this->hasMany(Equipment::class, 'equipment_type_id');
    }

    public function equipableTypes(): HasMany
    {
        return $this->hasMany(EquipableType::class, 'equipment_type_id');
    }
        public function craftType()
    {
        return $this->belongsTo(CraftType::class, 'craft_type_id');
    }
}
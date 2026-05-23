<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CraftType extends Model
{
    protected $fillable = [
        'key',
        'name',
    ];

    public function equipmentTypes()
    {
        return $this->hasMany(EquipmentType::class);
    }
}
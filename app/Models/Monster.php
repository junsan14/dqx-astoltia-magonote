<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Monster extends Model
{
    protected $fillable = [
        'monster_no',
        'name',
        'system_type',
        'normal_drop',
        'rare_drop',
        'source_url',
    ];

    public function spawns(): HasMany
    {
    return $this->hasMany(MonsterMapSpawn::class);    
    //return $this->hasMany(MonsterSpawn::class);
    }

    public function whiteBoxes(): HasMany
    {
        return $this->hasMany(MonsterWhiteBox::class);
    }

}
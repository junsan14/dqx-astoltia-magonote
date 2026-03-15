<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Map extends Model
{
    protected $fillable = [
        'continent',
        'name',
        'map_type',
        'source_url'
    ];
    public function spawns()
    {
        return $this->hasMany(MonsterMapSpawn::class);
    }
    public function layers(): HasMany
    {
        return $this->hasMany(MapLayer::class)->orderBy('display_order');
    }
}
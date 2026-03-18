<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonsterMapSpawn extends Model
{
    protected $fillable = [
        'monster_id',
        'map_id',
        'area',
        'spawn_count',
        'symbol_count',
        'map_layer_id',
        'note',
        'spawn_time',
        'marker_x',
        'marker_y',
        
    ];
    public function monster()
{
    return $this->belongsTo(Monster::class);
}

public function map()
{
    return $this->belongsTo(Map::class);
}

}
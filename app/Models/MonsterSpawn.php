<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonsterSpawn extends Model
{
    protected $fillable = [
        'monster_id',
        'location_name',
        'area_note',
        'time_zone',
    ];

    public function monster(): BelongsTo
    {
        return $this->belongsTo(Monster::class);
    }
}
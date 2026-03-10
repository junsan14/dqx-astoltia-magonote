<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonsterDrop extends Model
{
    protected $fillable = [
        'monster_id',
        'drop_target_type',
        'drop_target_id',
        'drop_type',
        'sort_order',
    ];

    public function monster()
    {
        return $this->belongsTo(Monster::class);
    }
}
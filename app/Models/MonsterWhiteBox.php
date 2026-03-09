<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonsterWhiteBox extends Model
{
    protected $fillable = [
        'monster_id',
        'item_name',
    ];

    public function monster(): BelongsTo
    {
        return $this->belongsTo(Monster::class);
    }
}
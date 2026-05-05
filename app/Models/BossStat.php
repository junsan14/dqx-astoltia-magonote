<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BossStat extends Model
{
    protected $fillable = [
        'boss_id',
        'variant',
        'level',
        'hp',
        'mp',
        'attack',
        'defense',
        'magic_attack',
        'magic_defense',
        'agility',
        'weight',
        'extra_stats_json',
        'note',
    ];

    protected $casts = [
        'extra_stats_json' => 'array',
    ];

    public function boss()
    {
        return $this->belongsTo(Boss::class);
    }
}
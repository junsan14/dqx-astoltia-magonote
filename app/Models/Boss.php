<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Boss extends Model
{
    protected $fillable = [
        'boss_id',
        'name',
        'name_en',
        'category',
        'series',
        'race',
        'image_url',
        'source_url',
        'description',
        'note',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function stats()
    {
        return $this->hasMany(BossStat::class);
    }

    public function pushWeights()
    {
        return $this->hasMany(BossPushWeight::class);
    }
}
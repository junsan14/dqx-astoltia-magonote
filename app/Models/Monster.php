<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Monster extends Model
{
    protected $fillable = [
        'display_order',
        'name',
        'system_type',
        'source_url',
        'is_reincarnated',
        'reincarnation_parent_id',
        'image_path',
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
        public function drops()
    {
        return $this->hasMany(MonsterDrop::class);
    }
    public function reincarnationParent()
    {
        return $this->belongsTo(self::class, 'reincarnation_parent_id');
    }

    public function reincarnations()
    {
        return $this->hasMany(self::class, 'reincarnation_parent_id');
    }
}
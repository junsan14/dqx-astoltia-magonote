<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GameJob extends Model
{
    protected $table = 'game_jobs';

    protected $fillable = [
        'key',
        'name',
    ];

    public function equipableTypes(): HasMany
    {
        return $this->hasMany(EquipableType::class, 'game_job_id');
    }
}
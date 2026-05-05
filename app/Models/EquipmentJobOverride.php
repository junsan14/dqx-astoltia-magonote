<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipmentJobOverride extends Model
{
    protected $table = 'equipment_job_overrides';

    protected $fillable = [
        'equipment_id',
        'game_job_id',
        'mode',
    ];

    protected $casts = [
        'equipment_id' => 'integer',
        'game_job_id' => 'integer',
    ];

    protected $attributes = [
        'mode' => 'allow',
    ];

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class, 'equipment_id');
    }

    public function gameJob(): BelongsTo
    {
        return $this->belongsTo(GameJob::class, 'game_job_id');
    }
}
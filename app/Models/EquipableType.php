<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipableType extends Model
{
    protected $table = 'equipable_types';

    protected $fillable = [
        'game_job_id',
        'equipment_type_id',
    ];

    public function equipmentType(): BelongsTo
    {
        return $this->belongsTo(EquipmentType::class, 'equipment_type_id');
    }

    public function gameJob(): BelongsTo
    {
        return $this->belongsTo(GameJob::class, 'game_job_id');
    }
}
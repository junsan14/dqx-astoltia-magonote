<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Equipment extends Model
{
    protected $table = 'equipments';

    protected $fillable = [
        'item_id',
        'item_name',
        'equipment_type_id',
        'job_override_mode',
        'craft_level',
        'equip_level',
        'recipe_book',
        'recipe_place',
        'description',
        'slot',
        'slot_grid_type',
        'slot_grid_cols',
        'group_kind',
        'group_id',
        'group_name',
        'materials_json',
        'slot_grid_json',
        'source_url',
        'detail_url',
        'effects_json',
    ];

    protected $casts = [
        'equipment_type_id' => 'integer',
        'craft_level' => 'integer',
        'equip_level' => 'integer',
        'slot_grid_cols' => 'integer',
        'materials_json' => 'array',
        'slot_grid_json' => 'array',
        'effects_json' => 'array',
        'override_jobs_json' => 'array',
    ];

    protected $attributes = [
        'job_override_mode' => 'inherit',
    ];

    public function equipmentType(): BelongsTo
    {
        return $this->belongsTo(EquipmentType::class, 'equipment_type_id');
    }
}
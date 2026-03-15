<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MapLayer extends Model
{
    protected $fillable = [
        'map_id',
        'layer_name',
        'floor_no',
        'image_path',
        'source_url',
        'display_order',
    ];

    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class);
    }
}
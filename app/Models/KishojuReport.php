<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KishojuReport extends Model
{
    protected $fillable = [
        'kishoju_room_id',
        'server_no',
        'map_name',
        'gauge_color',
        'reported_by',
        'memo',
    ];

    protected $touches = [
        'room',
    ];

    public function room()
    {
        return $this->belongsTo(KishojuRoom::class, 'kishoju_room_id');
    }
}
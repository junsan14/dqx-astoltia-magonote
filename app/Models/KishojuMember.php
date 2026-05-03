<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KishojuMember extends Model
{
    protected $fillable = [
        'kishoju_room_id',
        'name',
        'server_from',
        'server_to',
    ];

    protected $touches = [
        'room',
    ];

    public function room()
    {
        return $this->belongsTo(KishojuRoom::class, 'kishoju_room_id');
    }
}
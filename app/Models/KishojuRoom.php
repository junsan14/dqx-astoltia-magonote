<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KishojuRoom extends Model
{
    protected $fillable = [
        'public_id',
        'name',
        'status',
    ];

    public function members()
    {
        return $this->hasMany(KishojuMember::class);
    }

    public function reports()
    {
        return $this->hasMany(KishojuReport::class);
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Orb extends Model
{
    protected $fillable = [
        'name',
        'name_en',
        'color',
        'effect',
    ];
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CrystalRule extends Model
{
    protected $fillable = [
        'min_level',
        'max_level',
        'plus0',
        'plus1',
        'plus2',
        'plus3',
    ];
}

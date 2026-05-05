<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BossPushWeight extends Model
{
    protected $fillable = [
        'boss_id',
        'variant',
        'disadvantage_weight',
        'equal_weight',
        'win_weight',
        'complete_weight',
        'wb_disadvantage_weight',
        'wb_equal_weight',
        'wb_win_weight',
        'wb_complete_weight',
        'note',
    ];

    public function boss()
    {
        return $this->belongsTo(Boss::class);
    }
}
<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class WeeklyMapTask extends Model {
    protected $fillable = ['slot','week_start','category','body','body_en','continent_id','search_mode','map_id','monster_system_type_id','is_published'];
    protected $casts = ['is_published' => 'boolean'];
    public function systemType() { return $this->belongsTo(MonsterSystemType::class, 'monster_system_type_id'); }
}

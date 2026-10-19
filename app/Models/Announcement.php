<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $fillable = ['locale', 'category', 'page_label', 'page_path', 'title', 'body', 'published_at', 'source_refs'];
    protected $casts = ['published_at' => 'datetime', 'source_refs' => 'array'];
}

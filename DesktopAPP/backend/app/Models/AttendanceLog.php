<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceLog extends Model
{
    protected $fillable = [
        'user_id', 'shop_id', 'type', 'logged_at', 'latitude', 'longitude',
        'distance_meters', 'face_match_score', 'snapshot_path', 'is_manual', 'created_by',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
        'distance_meters' => 'float',
        'face_match_score' => 'float',
        'is_manual' => 'boolean',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}

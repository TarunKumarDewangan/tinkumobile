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

    protected $appends = ['photo_url'];

    /**
     * Served through a dedicated route (below) rather than Storage::url()'s
     * /storage/... symlink path — shared hosting can't always create that
     * symlink, and it must be re-run after every deploy that wipes public/.
     * Streaming the file directly from app/public has no such dependency.
     */
    public function getPhotoUrlAttribute(): ?string
    {
        return $this->snapshot_path ? url('api/attendance-photo/' . $this->snapshot_path) : null;
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}

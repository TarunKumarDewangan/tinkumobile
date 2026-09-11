<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceFaceProfile extends Model
{
    protected $fillable = ['user_id', 'descriptor', 'enrollment_photo_path', 'enrolled_at', 'enrolled_by'];

    protected $casts = [
        'descriptor' => 'array',
        'enrolled_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function enrolledBy(): BelongsTo { return $this->belongsTo(User::class, 'enrolled_by'); }
}

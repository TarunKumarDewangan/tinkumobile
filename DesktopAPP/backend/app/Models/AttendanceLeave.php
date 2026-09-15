<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceLeave extends Model
{
    protected $fillable = ['user_id', 'date', 'type', 'notes', 'created_by'];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}

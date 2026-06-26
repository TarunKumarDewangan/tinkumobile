<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title', 'description', 'assigned_by', 'assigned_to', 'shop_id',
        'related_type', 'related_id', 'priority', 'status',
        'due_date', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function updates()
    {
        return $this->hasMany(TaskUpdate::class);
    }

    /**
     * Get the related record (polymorphic).
     * Uses morph map defined in AppServiceProvider to resolve short type names.
     */
    public function related()
    {
        return $this->morphTo();
    }
}

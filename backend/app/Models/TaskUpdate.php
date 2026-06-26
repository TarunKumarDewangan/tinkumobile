<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskUpdate extends Model
{
    protected $fillable = [
        'task_id', 'updated_by', 'old_status', 'new_status', 'comment',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}

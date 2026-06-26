<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'model_type',
        'model_id',
        'description',
        'ip_address',
        'user_agent'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Static helper to log activities
     */
    public static function log($action, $model = null, $description = null)
    {
        return self::create([
            'user_id' => auth()->id() ?: 1, // Fallback to system admin if not logged in
            'action' => $action,
            'model_type' => $model ? get_class($model) : null,
            'model_id' => $model ? $model->id : null,
            'description' => $description,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent()
        ]);
    }
}

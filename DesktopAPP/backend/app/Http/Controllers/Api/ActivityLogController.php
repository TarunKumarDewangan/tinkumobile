<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = ActivityLog::with('user')->orderBy('created_at', 'desc');

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->action) {
            $query->where('action', 'like', "%{$request->action}%");
        }
        if ($request->model_type) {
            $query->where('model_type', 'like', "%{$request->model_type}%");
        }
        if ($request->from_date) {
            $query->where('created_at', '>=', $request->from_date . ' 00:00:00');
        }
        if ($request->to_date) {
            $query->where('created_at', '<=', $request->to_date . ' 23:59:59');
        }

        return response()->json($query->paginate(50));
    }

    public function destroy(Request $request, ActivityLog $activityLog)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $activityLog->delete();
        return response()->json(['message' => 'Log entry deleted']);
    }

    public function clear(Request $request)
    {
        if (!$request->user()->hasFullAccess()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = ActivityLog::query();
        if ($request->from_date && $request->to_date) {
            $query->whereBetween('created_at', [
                $request->from_date . ' 00:00:00',
                $request->to_date . ' 23:59:59',
            ]);
        }
        $count = $query->count();
        $query->delete();

        ActivityLog::log('LOGS_CLEARED', null, "Admin cleared {$count} activity log entries");

        return response()->json(['message' => "{$count} log entries cleared"]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    /**
     * List tasks — scoped by shop.
     * Manager sees all; employee sees only their assigned tasks.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Task::with(['assignedBy:id,name,emp_id', 'assignedTo:id,name,emp_id'])
            ->where('shop_id', $user->shop_id);

        // Non-managers see only their own tasks
        if (!$user->can('assign_tasks') && !$user->isOwner()) {
            $query->where('assigned_to', $user->id);
        }

        // Filter by status if provided
        if ($request->status) {
            $query->where('status', $request->status);
        }

        // Filter by assigned_to if provided (manager only)
        if ($request->assigned_to && ($user->can('assign_tasks') || $user->isOwner())) {
            $query->where('assigned_to', $request->assigned_to);
        }

        $tasks = $query->latest()->paginate($request->per_page ?? 50);

        return response()->json($tasks);
    }

    /**
     * Create a task (requires assign_tasks permission).
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // Only manager/owner can assign tasks
        if (!$user->can('assign_tasks') && !$user->isOwner()) {
            return response()->json(['message' => 'You do not have permission to assign tasks.'], 403);
        }

        $validated = $request->validate([
            'title'        => 'required|string|max:255',
            'description'  => 'nullable|string',
            'assigned_to'  => ['required', Rule::exists('users', 'id')->where('shop_id', $request->user()->shop_id)],
            'related_type' => 'nullable|string|in:repair,sale,customer,airtel_retailer',
            'related_id'   => 'nullable|integer|required_with:related_type',
            'priority'     => 'nullable|string|in:low,medium,high,urgent',
            'due_date'     => 'nullable|date',
        ]);

        $task = Task::create([
            'title'        => $validated['title'],
            'description'  => $validated['description'] ?? null,
            'assigned_by'  => $user->id,
            'assigned_to'  => $validated['assigned_to'],
            'shop_id'      => $user->shop_id,
            'related_type' => $validated['related_type'] ?? null,
            'related_id'   => $validated['related_id'] ?? null,
            'priority'     => $validated['priority'] ?? 'medium',
            'status'       => 'pending',
            'due_date'     => $validated['due_date'] ?? null,
        ]);

        // Log the creation
        TaskUpdate::create([
            'task_id'    => $task->id,
            'updated_by' => $user->id,
            'new_status' => 'pending',
            'comment'    => 'Task created',
        ]);

        ActivityLog::log('TASK_CREATED', $user, "Task #{$task->id}: {$task->title} assigned to user #{$validated['assigned_to']}");

        return response()->json($task->load(['assignedBy:id,name,emp_id', 'assignedTo:id,name,emp_id']), 201);
    }

    /**
     * View a single task with full update history.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $task = Task::with([
            'assignedBy:id,name,emp_id',
            'assignedTo:id,name,emp_id',
            'updates.updatedBy:id,name,emp_id',
        ])->findOrFail($id);

        // Ensure task belongs to user's shop
        if ($task->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        // Non-managers can only see their own tasks
        if (!$user->can('assign_tasks') && !$user->isOwner() && $task->assigned_to !== $user->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        // Include related record data if available
        $related = null;
        if ($task->related_type && $task->related_id) {
            $related = $task->related;
        }

        return response()->json([
            'task'    => $task,
            'related' => $related,
        ]);
    }

    /**
     * Update task details (manager/owner only).
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $task = Task::findOrFail($id);

        if ($task->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (!$user->can('assign_tasks') && !$user->isOwner()) {
            return response()->json(['message' => 'Only managers can edit tasks.'], 403);
        }

        $validated = $request->validate([
            'title'        => 'sometimes|string|max:255',
            'description'  => 'nullable|string',
            'assigned_to'  => 'sometimes|exists:users,id',
            'priority'     => 'nullable|string|in:low,medium,high,urgent',
            'due_date'     => 'nullable|date',
            'status'       => 'nullable|string|in:pending,in_progress,completed,cancelled',
        ]);

        $oldStatus = $task->status;
        $task->update($validated);

        // Log status change in task_updates for audit trail
        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            TaskUpdate::create([
                'task_id'    => $task->id,
                'updated_by' => $user->id,
                'old_status' => $oldStatus,
                'new_status' => $validated['status'],
                'comment'    => 'Status updated by manager',
            ]);
        }

        ActivityLog::log('TASK_UPDATED', $user, "Task #{$task->id}: {$task->title} updated");

        return response()->json($task->load(['assignedBy:id,name,emp_id', 'assignedTo:id,name,emp_id']));
    }

    /**
     * Update task status (assigned employee or manager).
     */
    public function updateStatus(Request $request, $id)
    {
        $user = $request->user();
        $task = Task::findOrFail($id);

        if ($task->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        // Only assigned employee or manager can change status
        $isAssignee = $task->assigned_to === $user->id;
        $isManager  = $user->can('assign_tasks') || $user->isOwner();

        if (!$isAssignee && !$isManager) {
            return response()->json(['message' => 'You are not assigned to this task.'], 403);
        }

        $validated = $request->validate([
            'status'  => 'required|string|in:pending,in_progress,completed,cancelled',
            'comment' => 'nullable|string|max:1000',
        ]);

        $oldStatus = $task->status;
        $newStatus = $validated['status'];

        // Validate status transitions
        $allowedTransitions = [
            'pending'     => ['in_progress', 'cancelled'],
            'in_progress' => ['completed', 'cancelled'],
            'completed'   => ['in_progress'], // reopen
            'cancelled'   => ['pending'],
        ];

        if (!in_array($newStatus, $allowedTransitions[$oldStatus] ?? [])) {
            return response()->json([
                'message' => "Invalid status transition from '{$oldStatus}' to '{$newStatus}'."
            ], 422);
        }

        // Update timestamps based on status
        $updates = ['status' => $newStatus];
        if ($newStatus === 'in_progress' && !$task->started_at) {
            $updates['started_at'] = now();
        }
        if ($newStatus === 'completed') {
            $updates['completed_at'] = now();
        }
        if ($newStatus === 'pending' || $newStatus === 'cancelled') {
            $updates['started_at'] = null;
            $updates['completed_at'] = null;
        }

        $task->update($updates);

        // Log the update
        TaskUpdate::create([
            'task_id'    => $task->id,
            'updated_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'comment'    => $validated['comment'] ?? null,
        ]);

        ActivityLog::log('TASK_STATUS_CHANGED', $user, "Task #{$task->id} changed from {$oldStatus} to {$newStatus}");

        return response()->json($task->load(['assignedBy:id,name,emp_id', 'assignedTo:id,name,emp_id']));
    }

    /**
     * Soft delete a task (manager/owner only).
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $task = Task::findOrFail($id);

        if ($task->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if (!$user->can('assign_tasks') && !$user->isOwner()) {
            return response()->json(['message' => 'Only managers can delete tasks.'], 403);
        }

        $task->delete();

        ActivityLog::log('TASK_DELETED', $user, "Task #{$task->id}: {$task->title} deleted");

        return response()->json(['message' => 'Task deleted successfully.']);
    }
}

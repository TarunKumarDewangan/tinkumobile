<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EntityNote;
use Illuminate\Http\Request;

class EntityNoteController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = EntityNote::with('entity', 'createdBy');

        if (! $user->hasFullAccess()) {
            $query->where('shop_id', $user->shop_id);
        } elseif ($request->shop_id) {
            $query->where('shop_id', $request->shop_id);
        }

        if ($request->category) $query->where('category', $request->category);
        if ($request->date)     $query->where('promise_date', $request->date);
        if ($request->from)     $query->where('promise_date', '>=', $request->from);
        if ($request->to)       $query->where('promise_date', '<=', $request->to);

        if ($request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%");
            });
        }

        return response()->json($query->latest('promise_date')->latest('id')->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'entity_id'       => 'nullable|exists:entities,id',
            'name'            => 'required|string|max:150',
            'phone'           => 'nullable|string|max:20',
            'category'        => 'nullable|string|max:50',
            'promise_date'    => 'required|date',
            'note'            => 'nullable|string|max:1000',
            'balance_at_time' => 'nullable|numeric',
        ]);

        $data['shop_id']    = $user->hasFullAccess() ? ($request->shop_id ?? $user->shop_id) : $user->shop_id;
        $data['created_by'] = $user->id;

        return response()->json(EntityNote::create($data)->load('entity', 'createdBy'), 201);
    }

    public function destroy(Request $request, EntityNote $entityNote)
    {
        $user = $request->user();
        if (! $user->hasFullAccess() && $entityNote->shop_id !== $user->shop_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $entityNote->delete();
        return response()->json(['message' => 'Note deleted']);
    }
}

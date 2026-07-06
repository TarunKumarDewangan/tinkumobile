<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;
use Throwable;

abstract class Controller
{
    /**
     * Log the real exception and return a safe JSON error response.
     *
     * Several controllers previously returned $e->getMessage() directly to
     * the client on internal failures, which can leak stack-trace-adjacent
     * internal details (query fragments, file paths, etc.) in production.
     * The real message is always logged; it's only echoed back to the
     * client when app.debug is on (local/dev), matching what Laravel's own
     * default exception page already does.
     */
    protected function errorResponse(Throwable $e, string $context, int $status = 500): JsonResponse
    {
        Log::error("{$context}: " . $e->getMessage(), ['exception' => $e]);

        $message = config('app.debug')
            ? "{$context}: " . $e->getMessage()
            : "{$context}. Please try again or contact support if the problem continues.";

        return response()->json(['message' => $message], $status);
    }
}

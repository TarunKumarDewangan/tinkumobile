<?php

use Illuminate\Support\Facades\Route;

Route::get('/{any}', function () {
    $path = public_path('index.html');
    if (file_exists($path)) {
        return file_get_contents($path);
    }
    return response('Frontend not built. Please run "npm run build" in the frontend directory.', 404);
})->where('any', '^(?!api).*$');

<?php

$dir = __DIR__ . '/public/assets';
$files = glob($dir . '/*.js');

foreach ($files as $file) {
    $content = file_get_contents($file);
    echo "File: " . basename($file) . "\n";
    
    // Search for baseURL
    $pos = strpos($content, 'baseURL');
    if ($pos !== false) {
        echo "  Found baseURL: " . substr($content, $pos - 50, 100) . "\n";
    }
    
    // Search for api.tinkumobile.in or similar
    if (str_contains($content, 'tinkumobile')) {
        echo "  Found 'tinkumobile' in file.\n";
        // Find occurrences
        $offset = 0;
        while (($p = strpos($content, 'tinkumobile', $offset)) !== false) {
            echo "    Context: " . substr($content, $p - 40, 80) . "\n";
            $offset = $p + 1;
        }
    }
}

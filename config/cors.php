<?php

return [
    /*
     * You can enable CORS for 1 or multiple URLs, using wildcards (* = allow all)
     */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://tinkumobile.in',
        'https://www.tinkumobile.in',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    /*
     * Sets the Access-Control-Allow-Credentials header.
     * Leave as false since we use Bearer tokens, not cookies.
     */
    'supports_credentials' => false,
];

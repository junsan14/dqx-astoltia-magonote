<?php

return [
    'material_url' => env(
        'DQX_SOUBA_MATERIAL_URL',
        'https://dqx-souba.game-blog.app/watching_material'
    ),

    'user_agent' => env(
        'DQX_SOUBA_USER_AGENT',
        'DQX-Tool-Material-Price-Updater/1.0 (+https://www.dqx-tool.com/)'
    ),

    'items_per_page' => 10,

    'minimum_expected_items' => (int) env(
        'DQX_SOUBA_MINIMUM_EXPECTED_ITEMS',
        50
    ),

    'request_interval_ms' => (int) env(
        'DQX_SOUBA_REQUEST_INTERVAL_MS',
        1000
    ),

    'connect_timeout' => (int) env(
        'DQX_SOUBA_CONNECT_TIMEOUT',
        10
    ),

    'timeout' => (int) env(
        'DQX_SOUBA_TIMEOUT',
        30
    ),

    'retry_times' => (int) env(
        'DQX_SOUBA_RETRY_TIMES',
        1
    ),

    'retry_sleep_ms' => (int) env(
        'DQX_SOUBA_RETRY_SLEEP_MS',
        1500
    ),
];

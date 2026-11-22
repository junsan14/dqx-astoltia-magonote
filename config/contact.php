<?php

return [
    'recipient' => env('CONTACT_TO_ADDRESS'),
    'mailer' => env('CONTACT_MAILER', 'smtp'),
];

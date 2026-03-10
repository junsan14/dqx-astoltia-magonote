<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\MonsterController;


Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});



Route::get('/monsters/search', [MonsterController::class, 'index']);
Route::get('/monsters/{id}', [MonsterController::class, 'show']);

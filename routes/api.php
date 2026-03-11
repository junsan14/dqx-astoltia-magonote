<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\MonsterController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\OrbController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\MonsterLookupController;
use App\Http\Controllers\AccessoryController;
Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});





Route::Resource('accessories', AccessoryController::class);

Route::get('/monster-lookup', [MonsterLookupController::class, 'index']);


Route::Resource('/orbs', OrbController::class);
Route::Resource('/items', ItemController::class);

//Route::get('/equipments', [EquipmentController::class, 'index']);
Route::Resource('/equipments', EquipmentController::class);
//Route::get('/equipments', [EquipmentController::class, 'index']);
Route::get('/monsters/search', [MonsterController::class, 'index']);
Route::get('/monsters/{id}', [MonsterController::class, 'show']);

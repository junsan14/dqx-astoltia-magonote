<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\MonsterController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\OrbController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\MonsterLookupController;
use App\Http\Controllers\AccessoryController;
use App\Http\Controllers\EquipmentTypeController;
use App\Http\Controllers\GameJobController;
use App\Http\Controllers\MonsterMapSpawnController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\CrystalRuleController;


Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});




Route::Resource('/monster-map-spawns', MonsterMapSpawnController::class);


Route::get('/equipment-types', [EquipmentTypeController::class, 'index']);
Route::Resource('/game-jobs', GameJobController::class);

Route::get('/crystal-rules', [CrystalRuleController::class, 'index']);
Route::Resource('/accessories', AccessoryController::class);

//Route::get('/monster-lookup', [MonsterLookupController::class, 'index']);

Route::get('/maps/options', [MapController::class, 'options']);

Route::resource('maps', MapController::class)->only([
    'index',
    'show',
    'store',
    'update',
    'destroy'
]);

// 画像アップロード
Route::post('/maps/{map}/layers/upload', [MapController::class, 'uploadLayerImage']);

Route::Resource('/orbs', OrbController::class);
Route::get('/items/by-ids', [ItemController::class, 'byIds']);
Route::Resource('/items', ItemController::class);

//Route::get('/equipments', [EquipmentController::class, 'index']);
Route::Resource('/equipments', EquipmentController::class);
//Route::get('/equipments', [EquipmentController::class, 'index']);
//Route::get('/monsters/search', [MonsterController::class, 'index']);
Route::Resource('/monster-search', MonsterController::class);
Route::get('/monsters/around-display-order', [MonsterController::class, 'aroundDisplayOrder']);
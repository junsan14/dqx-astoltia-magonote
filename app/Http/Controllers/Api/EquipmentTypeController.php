<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EquipmentType;

class EquipmentTypeController extends Controller
{
    public function index()
    {
        $types = EquipmentType::with([
            'equipableTypes.gameJob'
        ])
        ->orderBy('id')
        ->get();

        return response()->json([
            'data' => $types
        ]);
    }
}
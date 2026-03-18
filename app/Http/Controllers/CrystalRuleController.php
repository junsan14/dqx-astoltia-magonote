<?php

namespace App\Http\Controllers;

use App\Models\CrystalRule;

class CrystalRuleController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => CrystalRule::orderBy('min_level')->get()
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Models\CrystalRule;
use Illuminate\Http\Request;

class CrystalRuleController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => CrystalRule::orderBy('min_level')->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'min_level' => ['required', 'integer'],
            'max_level' => ['required', 'integer'],
            'plus0' => ['required', 'integer'],
            'plus1' => ['required', 'integer'],
            'plus2' => ['required', 'integer'],
            'plus3' => ['required', 'integer'],
        ]);

        $rule = CrystalRule::create($validated);

        return response()->json([
            'data' => $rule
        ], 201);
    }

    public function update(Request $request, CrystalRule $crystalRule)
    {
        $validated = $request->validate([
            'min_level' => ['required', 'integer'],
            'max_level' => ['required', 'integer'],
            'plus0' => ['required', 'integer'],
            'plus1' => ['required', 'integer'],
            'plus2' => ['required', 'integer'],
            'plus3' => ['required', 'integer'],
        ]);

        $crystalRule->update($validated);

        return response()->json([
            'data' => $crystalRule
        ]);
    }
    public function destroy(CrystalRule $crystalRule)
    {
        $crystalRule->delete();

        return response()->json([
            'message' => 'deleted'
        ]);
    }
}
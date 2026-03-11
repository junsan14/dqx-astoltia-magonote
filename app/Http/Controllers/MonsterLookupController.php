<?php

namespace App\Http\Controllers;

use App\Models\Monster;
use Illuminate\Http\Request;

class MonsterLookupController extends Controller
{
    public function index(Request $request)
    {
        $keyword = trim((string) $request->get('keyword', ''));

        $query = Monster::query()
            ->select('id', 'monster_no', 'name', 'system_type');

        if ($keyword !== '') {
            $escapedKeyword = addcslashes($keyword, '\\%_');

            $query->where(function ($sub) use ($keyword, $escapedKeyword) {
                $sub->where('name', 'like', '%' . $escapedKeyword . '%')
                    ->orWhere('system_type', 'like', '%' . $escapedKeyword . '%');

                if (is_numeric($keyword)) {
                    $sub->orWhere('monster_no', (int) $keyword)
                        ->orWhere('id', (int) $keyword);
                }
            })
            ->orderByRaw(
                "
                CASE
                    WHEN name = ? THEN 0
                    WHEN name LIKE ? THEN 1
                    ELSE 2
                END
                ",
                [$keyword, $escapedKeyword . '%']
            )
            ->orderByRaw('LENGTH(name) ASC')
            ->orderBy('name');
        } else {
            $query->orderBy('name');
        }

        return response()->json([
            'data' => $query->limit(20)->get(),
        ]);
    }
}
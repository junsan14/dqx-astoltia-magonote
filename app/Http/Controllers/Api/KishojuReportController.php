<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KishojuReport;
use App\Models\KishojuRoom;
use Illuminate\Http\Request;

class KishojuReportController extends Controller
{
    public function index(string $publicId)
    {
        $room = KishojuRoom::where('public_id', $publicId)->firstOrFail();

        $reports = KishojuReport::where('kishoju_room_id', $room->id)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json([
            'reports' => $reports,
        ]);
    }

    public function store(Request $request, string $publicId)
    {
        $validated = $request->validate([
            'server_no' => ['required', 'integer', 'min:1', 'max:40'],
            'map_name' => ['required', 'string', 'max:50'],
            'gauge_color' => ['required', 'string', 'max:20'],
            'reported_by' => ['required', 'string', 'max:50'],
            'memo' => ['nullable', 'string', 'max:500'],
        ]);

        $room = KishojuRoom::where('public_id', $publicId)->firstOrFail();

        $report = KishojuReport::create([
            'kishoju_room_id' => $room->id,
            'server_no' => $validated['server_no'],
            'map_name' => $validated['map_name'],
            'gauge_color' => $validated['gauge_color'],
            'reported_by' => $validated['reported_by'],
            'memo' => $validated['memo'] ?? null,
        ]);

        return response()->json([
            'report' => $report,
        ], 201);
    }
    public function destroy(string $publicId, int $reportId)
    {
        $room = KishojuRoom::where('public_id', $publicId)->firstOrFail();

        $report = KishojuReport::where('kishoju_room_id', $room->id)
            ->where('id', $reportId)
            ->firstOrFail();

        $report->delete();

        return response()->json([
            'message' => 'deleted',
        ]);
    }
}
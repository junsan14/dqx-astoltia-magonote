<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KishojuMember;
use App\Models\KishojuRoom;
use Illuminate\Http\Request;

class KishojuRoomController extends Controller
{
    public function adminIndex()
    {
        $rooms = KishojuRoom::query()
            ->where('status', 'open')
            ->withCount(['members', 'reports'])
            ->with([
                'members' => fn ($query) => $query->latest(),
                'reports' => fn ($query) => $query->latest()->limit(100),
            ])
            ->latest()
            ->get();

        return response()->json([
            'rooms' => $rooms,
        ]);
    }
    public function adminNearRainbow()
{
    $rooms = KishojuRoom::query()
        ->where('status', 'open')
        ->withCount('members')
        ->with([
            'reports' => fn ($query) => $query
                ->whereIn('gauge_color', ['赤', 'red'])
                ->latest()
                ->limit(100),
        ])
        ->latest()
        ->get();

    $items = $rooms
        ->flatMap(function ($room) {
            return $room->reports->map(function ($report) use ($room) {
                return [
                    'id' => $report->id,
                    'room_id' => $room->id,
                    'room_name' => $room->name,
                    'room_public_id' => $room->public_id,
                    'server_no' => $report->server_no,
                    'map_name' => $report->map_name,
                    'gauge_color' => $report->gauge_color,
                    'reported_by' => $report->reported_by,
                    'memo' => $report->memo,
                    'created_at' => $report->created_at,
                ];
            });
        })
        ->sortBy(function ($item) {
            return strtotime($item['created_at']);
        })
        ->values();

    return response()->json([
        'rooms_count' => $rooms->count(),
        'members_count' => $rooms->sum('members_count'),
        'items' => $items,
    ]);
}
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100'],
        ]);

        $room = KishojuRoom::create([
            'public_id' => $this->generatePublicId(),
            'name' => $validated['name'] ?? '輝晶獣 分散ルーム',
            'status' => 'open',
        ]);

        return response()->json([
            'room' => $room,
        ], 201);
    }

    public function show(string $publicId)
    {
        $room = KishojuRoom::where('public_id', $publicId)
            ->with([
                'members' => fn ($query) => $query->latest(),
                'reports' => fn ($query) => $query->latest()->limit(100),
            ])
            ->firstOrFail();

        return response()->json([
            'room' => $room,
        ]);
    }

    public function join(Request $request, string $publicId)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'server_from' => ['required', 'integer', 'min:1', 'max:40'],
            'server_to' => ['required', 'integer', 'min:1', 'max:40', 'gte:server_from'],
        ]);

        $room = KishojuRoom::where('public_id', $publicId)->firstOrFail();

        $member = KishojuMember::create([
            'kishoju_room_id' => $room->id,
            'name' => $validated['name'],
            'server_from' => $validated['server_from'],
            'server_to' => $validated['server_to'],
        ]);

        return response()->json([
            'member' => $member,
        ], 201);
    }
    public function destroyMember(string $publicId, int $memberId)
    {
        $room = KishojuRoom::where('public_id', $publicId)->firstOrFail();

        $member = KishojuMember::where('kishoju_room_id', $room->id)
            ->where('id', $memberId)
            ->firstOrFail();

        $member->delete();

        return response()->json([
            'message' => 'ユーザーを削除しました',
        ]);
    }
    private function generatePublicId(): string
    {
        $words = [
            'sora',
            'kaze',
            'niji',
            'hoshi',
            'tsuki',
            'yuki',
            'hana',
            'mori',
            'umi',
            'tori',
            'kumo',
            'hikari',
            'asahi',
            'yoru',
            'ame',
            'ao',
            'aka',
            'gin',
            'kin',
            'ruri',
            'ren',
            'suzu',
            'hayate',
            'kohaku',
            'hotaru',
            'komorebi',
            'shizuku',
            'akatsuki',
            'kirameki',
            'yamabuki',
            'aoba',
            'mizuki',
            'kasumi',
            'hibiki',
            'nagisa',
            'kanata',
            'ibuki',
            'subaru',
            'tsubasa',
            'hotori',
            'minato',
        ];

        do {
            $firstWord = $words[array_rand($words)];

            do {
                $secondWord = $words[array_rand($words)];
            } while ($secondWord === $firstWord);

            $number = str_pad((string) random_int(0, 999), 3, '0', STR_PAD_LEFT);

            $publicId = "{$firstWord}-{$secondWord}-{$number}";
        } while (KishojuRoom::where('public_id', $publicId)->exists());

        return $publicId;
    }
}
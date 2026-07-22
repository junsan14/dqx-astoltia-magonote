<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Services\DqxSoubaMaterialScraper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class UpdateItemMarketPricesController extends Controller
{
    public function __invoke(
        Request $request,
        DqxSoubaMaterialScraper $scraper
    ): JsonResponse {
        if (! (bool) $request->user()?->is_admin) {
            return response()->json([
                'message' => '管理者だけが素材価格を更新できます。',
            ], 403);
        }

        $lock = Cache::lock(
            'admin:update-item-market-prices',
            180
        );

        if (! $lock->get()) {
            return response()->json([
                'message' => '別の素材価格更新処理が実行中です。',
            ], 409);
        }

        try {
            $prices = $scraper->fetchAll();

            $items = Item::query()
                ->select(['id', 'name', 'buy_price'])
                ->get();

            $itemsByName = [];

            foreach ($items as $item) {
                $normalizedName = $scraper->normalizeName(
                    (string) $item->name
                );

                $itemsByName[$normalizedName][] = $item;
            }

            $updates = [];
            $notFound = [];
            $duplicates = [];
            $unchanged = 0;

            foreach ($prices as $normalizedName => $price) {
                $matches = $itemsByName[$normalizedName] ?? [];

                if ($matches === []) {
                    $notFound[] = $normalizedName;
                    continue;
                }

                if (count($matches) > 1) {
                    $duplicates[] = $normalizedName;
                    continue;
                }

                $item = $matches[0];

                $roundedPrice = $this->roundUpToTwoSignificantDigits(
                    (int) $price
                );

                if ((int) $item->buy_price === $roundedPrice) {
                    $unchanged++;
                    continue;
                }

                $updates[] = [
                    'id' => (int) $item->id,
                    'price' => $roundedPrice,
                ];
            }

            DB::transaction(function () use ($updates): void {
                $now = now();

                foreach ($updates as $update) {
                    Item::query()
                        ->whereKey($update['id'])
                        ->update([
                            'buy_price' => $update['price'],
                            'updated_at' => $now,
                        ]);
                }
            });

            return response()->json([
                'message' => sprintf(
                    '%d件の素材価格を更新しました。',
                    count($updates)
                ),
                'fetched_count' => count($prices),
                'updated_count' => count($updates),
                'unchanged_count' => $unchanged,
                'not_found_count' => count($notFound),
                'duplicate_count' => count($duplicates),
                'not_found_names' => array_values($notFound),
                'duplicate_names' => array_values($duplicates),
                'fetched_at' => now()->toIso8601String(),
            ]);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        } finally {
            optional($lock)->release();
        }
    }
    private function roundUpToTwoSignificantDigits(int $price): int
{
    if ($price <= 0) {
        return 0;
    }

    $digits = strlen((string) $price);

    // 1桁・2桁はそのまま
    if ($digits <= 2) {
        return $price;
    }

    $unit = 10 ** ($digits - 2);

    return (int) (ceil($price / $unit) * $unit);
}
}

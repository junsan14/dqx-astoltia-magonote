<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

class MapController extends Controller
{
    public function index(Request $request)
    {
        $keyword = trim((string) $request->get('q', ''));

        $query = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->orderBy('id', 'asc');

        if ($keyword !== '') {
            $query->where(function ($sub) use ($keyword) {
                $sub->where('name', 'like', "%{$keyword}%")
                    ->orWhere('continent', 'like', "%{$keyword}%")
                    ->orWhere('map_type', 'like', "%{$keyword}%");
            });
        }

        $rows = $query->get();
        $mapIds = $rows->pluck('id')->filter()->values();

        $layersByMapId = collect();

        if ($mapIds->isNotEmpty()) {
            $layers = DB::table('map_layers')
                ->select(
                    'id',
                    'map_id',
                    'layer_name',
                    'floor_no',
                    'image_path',
                    'source_url',
                    'display_order',
                    'created_at',
                    'updated_at'
                )
                ->whereIn('map_id', $mapIds)
                ->orderBy('map_id', 'asc')
                ->orderBy('display_order', 'asc')
                ->orderBy('floor_no', 'asc')
                ->orderBy('id', 'asc')
                ->get();

            $layersByMapId = $layers->groupBy('map_id');
        }

        $data = $rows->map(function ($row) use ($layersByMapId) {
            return [
                'id' => $row->id,
                'continent' => $row->continent,
                'continent_folder' => null,
                'name' => $row->name,
                'map_type' => $row->map_type,
                'source_url' => $row->source_url,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
                'layers' => ($layersByMapId->get($row->id) ?? collect())->values(),
            ];
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    public function show(string $id)
    {
        $row = DB::table('maps')
            ->select(
                'id',
                'continent',
                'name',
                'map_type',
                'source_url',
                'created_at',
                'updated_at'
            )
            ->where('id', $id)
            ->first();

        if (!$row) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        $layers = $this->getLayersByMapId($row->id);

        return response()->json([
            'data' => [
                'id' => $row->id,
                'continent' => $row->continent,
                'continent_folder' => null,
                'name' => $row->name,
                'map_type' => $row->map_type,
                'source_url' => $row->source_url,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
                'layers' => $layers,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateMapRequest($request, false);
        $layers = $this->extractLayers($request);

        $mapId = DB::transaction(function () use ($request, $data, $layers) {
            $mapId = DB::table('maps')->insertGetId([
                'continent' => $data['continent'],
                'name' => $data['name'],
                'map_type' => $data['map_type'],
                'source_url' => $this->nullableString($data['source_url'] ?? null),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->syncLayers($request, $mapId, $layers, [
                'continent_folder' => $data['continent_folder'],
            ]);

            return $mapId;
        });

        return $this->show((string) $mapId);
    }

    public function update(Request $request, string $id)
    {
        $row = DB::table('maps')
            ->select('id', 'continent')
            ->where('id', $id)
            ->first();

        if (!$row) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        $data = $this->validateMapRequest($request, true);
        $layers = $this->extractLayers($request);

        DB::transaction(function () use ($request, $id, $row, $data, $layers) {
            $updateData = [
                'updated_at' => now(),
            ];

            if (array_key_exists('continent', $data)) {
                $updateData['continent'] = $data['continent'];
            }

            if (array_key_exists('name', $data)) {
                $updateData['name'] = $data['name'];
            }

            if (array_key_exists('map_type', $data)) {
                $updateData['map_type'] = $data['map_type'];
            }

            if (array_key_exists('source_url', $data)) {
                $updateData['source_url'] = $this->nullableString($data['source_url']);
            }

            DB::table('maps')
                ->where('id', $id)
                ->update($updateData);

            if ($this->requestHasLayers($request)) {
                $this->syncLayers($request, (int) $id, $layers, [
                    'continent_folder' => $data['continent_folder'] ?? $this->toContinentFolder($row->continent),
                ]);
            }
        });

        return $this->show($id);
    }

    public function destroy(string $id)
    {
        $exists = DB::table('maps')->where('id', $id)->exists();

        if (!$exists) {
            return response()->json([
                'message' => 'マップが見つからない',
            ], 404);
        }

        DB::transaction(function () use ($id) {
            $layers = DB::table('map_layers')
                ->select('image_path')
                ->where('map_id', $id)
                ->get();

            foreach ($layers as $layer) {
                $this->deleteImageIfExists($layer->image_path);
            }

            DB::table('map_layers')->where('map_id', $id)->delete();
            DB::table('maps')->where('id', $id)->delete();
        });

        return response()->json([
            'success' => true,
        ]);
    }

    public function options()
    {
        $continents = DB::table('maps')
            ->whereNotNull('continent')
            ->where('continent', '<>', '')
            ->distinct()
            ->orderBy('continent', 'asc')
            ->pluck('continent')
            ->values();

        $mapTypes = DB::table('maps')
            ->whereNotNull('map_type')
            ->where('map_type', '<>', '')
            ->distinct()
            ->orderBy('map_type', 'asc')
            ->pluck('map_type')
            ->values();

        return response()->json([
            'data' => [
                'continents' => $continents,
                'map_types' => $mapTypes,
            ],
        ]);
    }

    private function validateMapRequest(Request $request, bool $isUpdate = false): array
    {
        return $request->validate([
            'continent' => $isUpdate
                ? ['sometimes', 'required', 'string', 'max:255']
                : ['required', 'string', 'max:255'],
            'continent_folder' => $isUpdate
                ? ['sometimes', 'required', 'string', 'max:255']
                : ['required', 'string', 'max:255'],
            'name' => $isUpdate
                ? ['sometimes', 'required', 'string', 'max:255']
                : ['required', 'string', 'max:255'],
            'map_type' => $isUpdate
                ? ['sometimes', 'required', 'string', 'max:255']
                : ['required', 'string', 'max:255'],
            'source_url' => ['nullable', 'string', 'max:255'],
            'layers' => ['nullable'],
        ]);
    }

    private function extractLayers(Request $request): array
    {
        $layers = $request->input('layers', []);

        if (is_string($layers)) {
            $decoded = json_decode($layers, true);
            $layers = is_array($decoded) ? $decoded : [];
        }

        if (!is_array($layers)) {
            return [];
        }

        return array_values(array_map(function ($layer, $index) {
            $layer = is_array($layer) ? $layer : [];

            return [
                'id' => isset($layer['id']) && $layer['id'] !== '' ? (int) $layer['id'] : null,
                'layer_name' => $this->nullableString($layer['layer_name'] ?? null),
                'layer_file_name' => $this->sanitizeLayerFileName($layer['layer_file_name'] ?? null),
                'floor_no' => isset($layer['floor_no']) && $layer['floor_no'] !== ''
                    ? (int) $layer['floor_no']
                    : 0,
                'source_url' => $this->nullableString($layer['source_url'] ?? null),
                'display_order' => isset($layer['display_order']) && $layer['display_order'] !== ''
                    ? max(1, (int) $layer['display_order'])
                    : ($index + 1),
            ];
        }, $layers, array_keys($layers)));
    }

    private function requestHasLayers(Request $request): bool
    {
        return $request->has('layers') || data_get($request->allFiles(), 'layers') !== null;
    }

    private function getLayersByMapId(int|string $mapId)
    {
        return DB::table('map_layers')
            ->select(
                'id',
                'map_id',
                'layer_name',
                'floor_no',
                'image_path',
                'source_url',
                'display_order',
                'created_at',
                'updated_at'
            )
            ->where('map_id', $mapId)
            ->orderBy('display_order', 'asc')
            ->orderBy('floor_no', 'asc')
            ->orderBy('id', 'asc')
            ->get();
    }

    private function syncLayers(Request $request, int|string $mapId, array $layers, array $mapData): void
    {
        $existingIds = DB::table('map_layers')
            ->where('map_id', $mapId)
            ->pluck('id')
            ->map(fn ($value) => (int) $value)
            ->all();

        $keptIds = [];

        foreach ($layers as $index => $layer) {
            $layerId = $layer['id'] ?? null;
            $floorNo = (int) ($layer['floor_no'] ?? 0);
            $layerName = $this->nullableString($layer['layer_name'] ?? null);
            $layerFileName = $this->sanitizeLayerFileName($layer['layer_file_name'] ?? null);

            $payload = [
                'map_id' => $mapId,
                'layer_name' => $layerName,
                'floor_no' => $floorNo,
                'source_url' => $this->nullableString($layer['source_url'] ?? null),
                'display_order' => max(1, (int) ($layer['display_order'] ?? ($index + 1))),
                'updated_at' => now(),
            ];

            /** @var UploadedFile|null $uploadedFile */
            $uploadedFile = data_get($request->allFiles(), "layers.$index.image");

            if (!$uploadedFile instanceof UploadedFile) {
                $uploadedFile = data_get($request->allFiles(), "layers.$index.image_file");
            }

            if ($uploadedFile instanceof UploadedFile && $layerFileName === '') {
                throw new \InvalidArgumentException("layers.{$index}.layer_file_name is required");
            }

            if ($layerId && in_array($layerId, $existingIds, true)) {
                $oldLayer = DB::table('map_layers')
                    ->select('image_path')
                    ->where('id', $layerId)
                    ->where('map_id', $mapId)
                    ->first();

                $payload['image_path'] = $oldLayer?->image_path;

                if ($uploadedFile instanceof UploadedFile) {
                    $newImagePath = $this->storeLayerImage(
                        $uploadedFile,
                        $mapId,
                        $mapData['continent_folder'],
                        $layerFileName
                    );

                    if (!empty($oldLayer?->image_path) && $oldLayer->image_path !== $newImagePath) {
                        $this->deleteImageIfExists($oldLayer->image_path);
                    }

                    $payload['image_path'] = $newImagePath;
                }

                DB::table('map_layers')
                    ->where('id', $layerId)
                    ->where('map_id', $mapId)
                    ->update($payload);

                $keptIds[] = $layerId;
                continue;
            }

            if ($uploadedFile instanceof UploadedFile) {
                $payload['image_path'] = $this->storeLayerImage(
                    $uploadedFile,
                    $mapId,
                    $mapData['continent_folder'],
                    $layerFileName
                );
            } else {
                $payload['image_path'] = null;
            }

            $newId = DB::table('map_layers')->insertGetId([
                ...$payload,
                'created_at' => now(),
            ]);

            $keptIds[] = (int) $newId;
        }

        $deleteIds = array_values(array_diff($existingIds, $keptIds));

        if (!empty($deleteIds)) {
            $deleteLayers = DB::table('map_layers')
                ->select('image_path')
                ->where('map_id', $mapId)
                ->whereIn('id', $deleteIds)
                ->get();

            foreach ($deleteLayers as $deleteLayer) {
                $this->deleteImageIfExists($deleteLayer->image_path);
            }

            DB::table('map_layers')
                ->where('map_id', $mapId)
                ->whereIn('id', $deleteIds)
                ->delete();
        }
    }

   private function storeLayerImage(
    UploadedFile $file,
    int|string $mapId,
    string $continentFolder,
    string $layerFileName
): string {
    $continentFolder = $this->sanitizePathSegment($continentFolder);

    if ($continentFolder === '') {
        throw new \InvalidArgumentException('continent_folder is required');
    }

    $safeLayerFileName = $this->sanitizeLayerFileName($layerFileName);

    if ($safeLayerFileName === '') {
        throw new \InvalidArgumentException('layer_file_name is required');
    }

    $folder = "images/maps/{$continentFolder}/map_id_{$mapId}";
    $fileName = "{$safeLayerFileName}.webp";
    $storagePath = "{$folder}/{$fileName}";

    $manager = new ImageManager(new Driver());
    $image = $manager->read($file->getPathname());

    $width = $image->width();
    $height = $image->height();

    $cropWidth = 490;
    $cropHeight = 565;
    $offsetX = 35;
    $offsetY = 25;

    $canCrop = $width >= ($offsetX + $cropWidth) && $height >= ($offsetY + $cropHeight);

    if ($canCrop) {
        $image->crop($cropWidth, $cropHeight, $offsetX, $offsetY);
        $image->sharpen(15);
    } else {
        /**
         * クロップできない小さい画像は
         * そのまま webp 化だけする。
         * 必要なら軽く縮小して容量も抑える。
         */
        $maxWidth = 700;
        $maxHeight = 700;

        if ($width > $maxWidth || $height > $maxHeight) {
            $image->scaleDown($maxWidth, $maxHeight);
        }

        $image->sharpen(8);
    }

    $encoded = $image->encode(new WebpEncoder(quality: 65));

    Storage::disk('public')->put($storagePath, (string) $encoded);

    return '/storage/' . $storagePath;
}

    private function deleteImageIfExists(?string $publicPath): void
    {
        $publicPath = trim((string) $publicPath);

        if ($publicPath === '') {
            return;
        }

        $storagePath = preg_replace('#^/storage/#', '', $publicPath);

        if ($storagePath && Storage::disk('public')->exists($storagePath)) {
            Storage::disk('public')->delete($storagePath);
        }
    }

    private function sanitizePathSegment(?string $value): string
    {
        $value = trim((string) $value);
        $value = preg_replace('/[^A-Za-z0-9_\-]/', '', $value ?? '');

        return trim((string) $value);
    }

    private function sanitizeLayerFileName(?string $value): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return '';
        }

        $value = preg_replace('/\s+/', '', $value);
        $value = preg_replace('/[^A-Za-z0-9_\-]/', '', $value ?? '');

        return trim((string) $value);
    }

    private function toContinentFolder(?string $value): string
    {
        return $this->sanitizePathSegment($value);
    }

    private function nullableString($value): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : $value;
    }
}
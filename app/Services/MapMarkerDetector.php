<?php

namespace App\Services;

class MapMarkerDetector
{
    public function detectGreenMarkers(string $imagePath): array
    {
        if (!file_exists($imagePath)) {
            return [];
        }

        $binary = file_get_contents($imagePath);

        if ($binary === false) {
            return [];
        }

        // png / jpg / gif をまとめて読む
        $image = @imagecreatefromstring($binary);

        if (!$image) {
            return [];
        }

        $width = imagesx($image);
        $height = imagesy($image);

        $visited = [];
        $clusters = [];

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $key = "{$x}:{$y}";

                if (isset($visited[$key])) {
                    continue;
                }

                [$r, $g, $b] = $this->getRgb($image, $x, $y);

                if (!$this->isGreenMarkerPixel($r, $g, $b)) {
                    continue;
                }

                $cluster = $this->floodFillCluster($image, $x, $y, $width, $height, $visited);

                // 緑点として小さすぎるノイズは除外
                if (count($cluster) < 12) {
                    continue;
                }

                $clusters[] = $this->makeClusterCenter($cluster);
            }
        }

        imagedestroy($image);

        $clusters = $this->mergeNearbyCenters($clusters, 20);

        // 上から下、同じ段なら左から右
        usort($clusters, function ($a, $b) {
            if (abs($a['y'] - $b['y']) < 18) {
                return $a['x'] <=> $b['x'];
            }

            return $a['y'] <=> $b['y'];
        });

        return $clusters;
    }

    public function getImageSize(string $imagePath): array
    {
        $size = @getimagesize($imagePath);

        if (!$size) {
            return ['width' => 0, 'height' => 0];
        }

        return [
            'width' => $size[0],
            'height' => $size[1],
        ];
    }

    public function detectAreaFromPoint(int $x, int $y, int $width, int $height): string
    {
        $left = $width / 3;
        $right = ($width / 3) * 2;
        $top = $height / 3;
        $bottom = ($height / 3) * 2;

        $horizontal = '中央';
        $vertical = '中央';

        if ($x < $left) {
            $horizontal = '西';
        } elseif ($x > $right) {
            $horizontal = '東';
        }

        if ($y < $top) {
            $vertical = '北';
        } elseif ($y > $bottom) {
            $vertical = '南';
        }

        if ($vertical === '中央' && $horizontal === '中央') {
            return '中央';
        }

        if ($vertical === '中央') {
            return $horizontal;
        }

        if ($horizontal === '中央') {
            return $vertical;
        }

        return $vertical . $horizontal;
    }

    protected function getRgb($image, int $x, int $y): array
    {
        $rgb = imagecolorat($image, $x, $y);

        $r = ($rgb >> 16) & 0xFF;
        $g = ($rgb >> 8) & 0xFF;
        $b = $rgb & 0xFF;

        return [$r, $g, $b];
    }

    protected function isGreenMarkerPixel(int $r, int $g, int $b): bool
    {
        // dq10 の分布図の緑点向けにかなり寄せる
        return $g >= 200
            && $r >= 80 && $r <= 190
            && $b >= 0 && $b <= 120
            && ($g - $r) >= 50
            && ($g - $b) >= 90;
    }

    protected function floodFillCluster($image, int $startX, int $startY, int $width, int $height, array &$visited): array
    {
        $stack = [[$startX, $startY]];
        $cluster = [];

        while (!empty($stack)) {
            [$x, $y] = array_pop($stack);

            if ($x < 0 || $y < 0 || $x >= $width || $y >= $height) {
                continue;
            }

            $key = "{$x}:{$y}";
            if (isset($visited[$key])) {
                continue;
            }

            $visited[$key] = true;

            [$r, $g, $b] = $this->getRgb($image, $x, $y);

            if (!$this->isGreenMarkerPixel($r, $g, $b)) {
                continue;
            }

            $cluster[] = ['x' => $x, 'y' => $y];

            for ($dy = -1; $dy <= 1; $dy++) {
                for ($dx = -1; $dx <= 1; $dx++) {
                    if ($dx === 0 && $dy === 0) {
                        continue;
                    }

                    $stack[] = [$x + $dx, $y + $dy];
                }
            }
        }

        return $cluster;
    }

    protected function makeClusterCenter(array $cluster): array
    {
        $sumX = 0;
        $sumY = 0;

        foreach ($cluster as $point) {
            $sumX += $point['x'];
            $sumY += $point['y'];
        }

        return [
            'x' => (int) round($sumX / count($cluster)),
            'y' => (int) round($sumY / count($cluster)),
            'size' => count($cluster),
        ];
    }

    protected function mergeNearbyCenters(array $centers, int $distanceThreshold = 20): array
    {
        $merged = [];

        foreach ($centers as $center) {
            $mergedIntoExisting = false;

            foreach ($merged as &$existing) {
                $dx = $existing['x'] - $center['x'];
                $dy = $existing['y'] - $center['y'];
                $distance = sqrt($dx * $dx + $dy * $dy);

                if ($distance <= $distanceThreshold) {
                    $totalSize = $existing['size'] + $center['size'];

                    $existing['x'] = (int) round(
                        ($existing['x'] * $existing['size'] + $center['x'] * $center['size']) / $totalSize
                    );
                    $existing['y'] = (int) round(
                        ($existing['y'] * $existing['size'] + $center['y'] * $center['size']) / $totalSize
                    );
                    $existing['size'] = $totalSize;

                    $mergedIntoExisting = true;
                    break;
                }
            }

            if (!$mergedIntoExisting) {
                $merged[] = $center;
            }
        }

        return $merged;
    }
}
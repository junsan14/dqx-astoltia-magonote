<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

class ConvertMapImages extends Command
{
    protected $signature = 'maps:convert';
    protected $description = 'Crop map images and convert to optimized webp';

    public function handle()
    {
        $manager = new ImageManager(new Driver());

        $inputBase = storage_path('app/public/moto');
        $outputBase = storage_path('app/public/images/maps_new');

        File::ensureDirectoryExists($outputBase);

        $files = File::allFiles($inputBase);

        foreach ($files as $file) {

            if (!in_array(strtolower($file->getExtension()), ['jpg','jpeg','png','webp'])) {
                continue;
            }

            $inputPath = $file->getPathname();
            $filename = pathinfo($file->getFilename(), PATHINFO_FILENAME);
            $outputPath = $outputBase.'/'.$filename.'.webp';

            $this->info("Processing: {$inputPath}");

            try {

                $image = $manager->read($inputPath);

                /**
                 * crop
                 * 左35 上25
                 * 幅490 高さ565
                 */
                $image->crop(490, 565, 35, 25);

                /**
                 * 文字を読みやすく
                 */
                $image->sharpen(15);

                /**
                 * webp圧縮
                 */
                $encoded = $image->encode(new WebpEncoder(quality: 65));

                file_put_contents($outputPath, $encoded);

                $this->line("Saved → {$outputPath}");

            } catch (\Throwable $e) {

                $this->error("Failed: {$inputPath}");
                $this->error($e->getMessage());
            }
        }

        $this->info("All maps converted!");
    }
}
<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RetailerBulkSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $shopId = \App\Models\Shop::first()->id ?? 1;
        $files = array_merge(
            glob(database_path('seeders/*.txt')),
            glob(storage_path('*.txt'))
        );

        if (empty($files)) {
            $this->command->error("No retailer list files matching database/seeders/retailer_list_*.txt found.");
            return;
        }

        $count = 0;
        foreach ($files as $filePath) {
            $this->command->info("Processing file: $filePath");
            $content = file_get_contents($filePath);
            
            // Handle UTF-16 (often written by PowerShell)
            if (str_starts_with($content, "\xFF\xFE") || str_starts_with($content, "\xFE\xFF")) {
                $content = mb_convert_encoding($content, 'UTF-8', 'UTF-16');
            } else {
                $encoding = mb_detect_encoding($content, 'UTF-8, ISO-8859-1', true);
                if ($encoding && $encoding !== 'UTF-8') {
                    $content = mb_convert_encoding($content, 'UTF-8', $encoding);
                }
            }

            $lines = preg_split('/\r\n|\r|\n/', $content);
            
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;

                // Format: MSISDN_NAME
                if (str_contains($line, '_')) {
                    [$msisdn, $name] = explode('_', $line, 2);
                    $msisdn = trim($msisdn);
                    $name = trim($name);

                    if (strlen($msisdn) >= 10) {
                        // Clean non-UTF8 characters that might crash MySQL
                        $name = mb_convert_encoding($name, 'UTF-8', 'UTF-8');
                        // Remove any remaining non-standard characters just in case
                        $name = preg_replace('/[^\x20-\x7E\x{0900}-\x{097F}]/u', '', $name);
                        // Enforce length limit
                        $name = mb_substr($name, 0, 190); 

                        \App\Models\Retailer::updateOrCreate(
                            ['msisdn' => $msisdn],
                            ['name' => $name, 'shop_id' => $shopId]
                        );
                        $count++;
                    }
                }
            }
        }

        $this->command->info("Total Imported: $count retailers.");
    }
}

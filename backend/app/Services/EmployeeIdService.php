<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use App\Models\Shop;

class EmployeeIdService
{
    /**
     * Generate the next employee ID.
     * Format: TM-{SHOP_INITIALS}-{4-digit-sequence}
     * 
     * Uses database-level locking (SELECT ... FOR UPDATE) for concurrency safety.
     */
    public static function generate(?int $shopId = null): string
    {
        if ($shopId === null || $shopId <= 0) {
            $maxUserSeq = DB::table('users')
                ->where('emp_id', 'like', 'TM-XX-%')
                ->selectRaw('CAST(SUBSTRING(emp_id, 7) AS UNSIGNED) as seq')
                ->orderByDesc('seq')
                ->value('seq') ?: 0;

            $maxEmpSeq = DB::table('employees')
                ->where('emp_id', 'like', 'TM-XX-%')
                ->selectRaw('CAST(SUBSTRING(emp_id, 7) AS UNSIGNED) as seq')
                ->orderByDesc('seq')
                ->value('seq') ?: 0;

            $nextSeq = max($maxUserSeq, $maxEmpSeq) + 1;
            return "TM-XX-" . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
        }

        return DB::transaction(function () use ($shopId) {
            $initials = self::getShopInitials($shopId);
            $prefix = "TM-{$initials}-";

            // Lock the shop's sequence row exclusively
            $sequence = DB::table('emp_id_sequences')
                ->where('shop_id', $shopId)
                ->lockForUpdate()
                ->first();

            if (!$sequence) {
                // First time — create a new sequence row starting at 1
                DB::table('emp_id_sequences')->insert([
                    'shop_id'   => $shopId,
                    'last_seq'  => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $nextSeq = 1;
            } else {
                $nextSeq = $sequence->last_seq + 1;
                DB::table('emp_id_sequences')
                    ->where('id', $sequence->id)
                    ->update(['last_seq' => $nextSeq, 'updated_at' => now()]);
            }

            return $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Extract shop initials from the shop name.
     * E.g., "TinkuMobiles S1" → "S1", "Main Branch" → "MB"
     */
    private static function getShopInitials(?int $shopId): string
    {
        if (!$shopId) return 'XX';

        $shop = Shop::find($shopId);
        if (!$shop || !$shop->name) return 'XX';

        $name = trim($shop->name);

        // If the name contains a short code as the last word (e.g., "TinkuMobiles S1"), use that
        $parts = preg_split('/\s+/', $name);
        $lastPart = end($parts);

        // If last part is short (2-4 chars), it's likely a shop code
        if (strlen($lastPart) <= 4 && preg_match('/^[A-Za-z0-9]+$/', $lastPart)) {
            return strtoupper($lastPart);
        }

        // Otherwise, take initials from each word
        $initials = '';
        foreach ($parts as $part) {
            if (!empty($part) && preg_match('/[A-Za-z]/', $part)) {
                $initials .= strtoupper($part[0]);
            }
        }

        return $initials ?: 'XX';
    }
}

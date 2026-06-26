<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Read all existing emp_id values and compute max sequence per shop
        $allEmpIds = DB::table('employees')
            ->whereNotNull('emp_id')
            ->where('emp_id', '!=', '')
            ->select('shop_id', 'emp_id')
            ->unionAll(
                DB::table('users')
                    ->whereNotNull('emp_id')
                    ->where('emp_id', '!=', '')
                    ->select('shop_id', 'emp_id')
            )
            ->get();

        $shopSequences = [];
        foreach ($allEmpIds as $row) {
            $shopId = $row->shop_id;
            if (empty($shopId)) {
                continue;
            }
            // Extract the 4-digit sequence from the end of emp_id
            preg_match('/(\d{4})$/', $row->emp_id, $matches);
            $seq = isset($matches[1]) ? (int) $matches[1] : 0;

            if (!isset($shopSequences[$shopId]) || $seq > $shopSequences[$shopId]) {
                $shopSequences[$shopId] = $seq;
            }
        }

        // Insert or update emp_id_sequences for each shop
        $now = now();
        foreach ($shopSequences as $shopId => $maxSeq) {
            $existing = DB::table('emp_id_sequences')->where('shop_id', $shopId)->first();
            if ($existing) {
                if ($maxSeq > $existing->last_seq) {
                    DB::table('emp_id_sequences')
                        ->where('id', $existing->id)
                        ->update(['last_seq' => $maxSeq, 'updated_at' => $now]);
                }
            } else {
                DB::table('emp_id_sequences')->insert([
                    'shop_id'    => $shopId,
                    'last_seq'   => $maxSeq,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Truncate emp_id_sequences to force re-seed
        DB::table('emp_id_sequences')->truncate();
    }
};

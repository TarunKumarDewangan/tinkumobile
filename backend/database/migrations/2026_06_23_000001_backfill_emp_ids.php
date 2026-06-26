<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Backfill emp_id for employees where it is NULL
        $employees = DB::table('employees')->whereNull('emp_id')->get();
        foreach ($employees as $employee) {
            $empId = $this->generateEmpId($employee->shop_id);
            if ($empId) {
                DB::table('employees')->where('id', $employee->id)->update(['emp_id' => $empId]);
            }
        }

        // Backfill emp_id for users where it is NULL
        $users = DB::table('users')->whereNull('emp_id')->get();
        foreach ($users as $user) {
            $empId = $this->generateEmpId($user->shop_id);
            if ($empId) {
                DB::table('users')->where('id', $user->id)->update(['emp_id' => $empId]);
            }
        }
    }

    public function down(): void
    {
        // Revert: set all backfilled emp_ids back to NULL
        DB::table('employees')->whereNotNull('emp_id')->update(['emp_id' => null]);
        DB::table('users')->whereNotNull('emp_id')->update(['emp_id' => null]);
    }

    /**
     * Generate emp_id inline (avoids dependency on EmployeeIdService which may use Cache::lock).
     * Format: TM-{SHOP_INITIALS}-{4-digit-seq}
     */
    private function generateEmpId(?int $shopId): ?string
    {
        $initials = $this->getShopInitials($shopId);
        $prefix = "TM-{$initials}-";

        $lastId = DB::table(function ($query) {
            $query->selectRaw('CAST(SUBSTRING(emp_id, -4) AS UNSIGNED) as seq')
                ->from('employees')
                ->whereNotNull('emp_id')
                ->where('emp_id', '!=', '')
                ->union(
                    DB::table('users')
                        ->selectRaw('CAST(SUBSTRING(emp_id, -4) AS UNSIGNED) as seq')
                        ->whereNotNull('emp_id')
                        ->where('emp_id', '!=', '')
                );
        }, 'combined')
            ->where('seq', '>=', 1)
            ->orderByDesc('seq')
            ->value('seq');

        $nextSeq = str_pad(($lastId ?: 0) + 1, 4, '0', STR_PAD_LEFT);
        return $prefix . $nextSeq;
    }

    private function getShopInitials(?int $shopId): string
    {
        if (!$shopId) return 'XX';

        $shop = DB::table('shops')->find($shopId);
        if (!$shop || !$shop->name) return 'XX';

        $name = trim($shop->name);
        $parts = preg_split('/\s+/', $name);
        $lastPart = end($parts);

        if (strlen($lastPart) <= 4 && preg_match('/^[A-Za-z0-9]+$/', $lastPart)) {
            return strtoupper($lastPart);
        }

        $initials = '';
        foreach ($parts as $part) {
            if (!empty($part) && preg_match('/[A-Za-z]/', $part)) {
                $initials .= strtoupper($part[0]);
            }
        }

        return $initials ?: 'XX';
    }
};

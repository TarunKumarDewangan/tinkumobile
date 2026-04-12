<?php

namespace App\Traits;

use App\Models\Customer;

trait SyncsWithCustomer
{
    /**
     * Syncs customer data and returns customer_id
     */
    public function syncCustomer(array $data, ?string $action = null): int
    {
        $phone = $data['customer_phone'] ?? $data['phone'] ?? null;
        if (!$phone) return 0;

        $updateData = [
            'name'    => $data['customer_name'] ?? $data['name'] ?? 'Unknown',
            'email'   => $data['customer_email'] ?? $data['email'] ?? null,
            'address' => $data['customer_address'] ?? $data['address'] ?? null,
        ];

        if ($action) {
            $updateData['last_action'] = $action;
            $updateData['last_action_date'] = now()->toDateString();
        }

        $customer = Customer::updateOrCreate(['phone' => $phone], $updateData);

        return $customer->id;
    }
}

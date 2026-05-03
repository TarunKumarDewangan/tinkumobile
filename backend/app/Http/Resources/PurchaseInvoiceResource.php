<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseInvoiceResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'invoice_no' => $this->invoice_no,
            'shop_id' => $this->shop_id,
            'shop' => $this->whenLoaded('shop'),
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier'),
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user'),
            'purchase_date' => $this->purchase_date,
            'expected_delivery_date' => $this->expected_delivery_date,
            'received_at' => $this->received_at,
            'status' => $this->status,
            'bill_type' => $this->bill_type,
            'total_amount' => $this->total_amount,
            'discount' => $this->discount,
            'cash_discount' => $this->cash_discount,
            'is_cash_discount_on_bill' => $this->is_cash_discount_on_bill,
            'calculate_gst' => $this->calculate_gst,
            'cgst_rate' => $this->cgst_rate,
            'sgst_rate' => $this->sgst_rate,
            'cgst_amount' => $this->cgst_amount,
            'sgst_amount' => $this->sgst_amount,
            'rounding_mode' => $this->rounding_mode,
            'round_off' => $this->round_off,
            'grand_total' => $this->grand_total,
            'total_paid' => $this->total_paid,
            'payment_status' => $this->payment_status,
            'notes' => $this->notes,
            'items' => PurchaseItemResource::collection($this->whenLoaded('items')),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleInvoiceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'invoice_no' => $this->invoice_no,
            'shop_id' => $this->shop_id,
            'shop' => $this->whenLoaded('shop'),
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer'),
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user'),
            'sale_date' => $this->sale_date,
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
            'payment_method' => $this->payment_method,
            'bill_type' => $this->bill_type,
            'is_cancelled' => $this->is_cancelled,
            'items' => SaleItemResource::collection($this->whenLoaded('items'))->resolve(),
            'gift_items' => $this->whenLoaded('giftItems'),
        ];
    }
}

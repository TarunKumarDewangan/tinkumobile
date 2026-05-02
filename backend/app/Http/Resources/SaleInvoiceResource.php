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

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseItemResource extends JsonResource
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
            'product_id' => $this->product_id,
            'product' => new ProductResource($this->whenLoaded('product')),
            'imei' => $this->imei,
            'ram' => $this->ram,
            'storage' => $this->storage,
            'color' => $this->color,
            'quantity' => $this->quantity,
            'received_quantity' => $this->received_quantity,
            'damaged_quantity' => $this->damaged_quantity,
            'unit_price' => $this->unit_price,
            'selling_price' => $this->selling_price,
            'wholeseller_price' => $this->wholeseller_price,
            'min_selling_price' => $this->min_selling_price,
            'max_selling_price' => $this->max_selling_price,
            'incentive_amount' => $this->incentive_amount,
            'total' => $this->total,
        ];
    }
}

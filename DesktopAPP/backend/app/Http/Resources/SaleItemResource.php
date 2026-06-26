<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleItemResource extends JsonResource
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
            'unit_price' => $this->unit_price,
            'total' => $this->total,
        ];
    }
}

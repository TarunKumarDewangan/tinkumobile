<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
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
            'name' => $this->name,
            'sku' => $this->sku,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category'),
            'purchase_price' => $this->purchase_price,
            'selling_price' => $this->selling_price,
            'wholeseller_price' => $this->wholeseller_price,
            'min_selling_price' => $this->min_selling_price,
            'max_selling_price' => $this->max_selling_price,
            'incentive_amount' => $this->incentive_amount,
            'attributes' => $this->attributes,
            'stock' => $this->whenLoaded('inventory', fn() => $this->inventory->sum('stock')),
            'condition' => $this->condition,
            'location' => $this->location,
        ];
    }
}

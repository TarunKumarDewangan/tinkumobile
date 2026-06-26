<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyOffer extends Model
{
    protected $fillable = ['name', 'product_id', 'start_date', 'end_date', 'target_quantity', 'reward_details', 'is_fulfilled', 'actual_sold'];

    protected $casts = ['is_fulfilled' => 'boolean'];

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function fulfillments(): HasMany { return $this->hasMany(OfferFulfillment::class, 'offer_id'); }
}

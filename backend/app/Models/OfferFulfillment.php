<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferFulfillment extends Model
{
    public $timestamps = false;
    protected $fillable = ['offer_id', 'fulfilled_date', 'notes'];

    public function offer(): BelongsTo { return $this->belongsTo(CompanyOffer::class, 'offer_id'); }
}

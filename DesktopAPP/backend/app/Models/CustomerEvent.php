<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerEvent extends Model
{
    use UppercaseStrings;
    protected $fillable = [
        'customer_id',
        'type',
        'name',
        'date'
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}

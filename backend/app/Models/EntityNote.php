<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityNote extends Model
{
    protected $fillable = [
        'entity_id',
        'sale_invoice_id',
        'name',
        'phone',
        'category',
        'promise_date',
        'note',
        'status',
        'resolved_at',
        'balance_at_time',
        'shop_id',
        'created_by',
    ];

    protected $casts = [
        'promise_date' => 'date:Y-m-d',
        'resolved_at' => 'datetime',
        'balance_at_time' => 'float',
    ];

    public function entity()
    {
        return $this->belongsTo(Entity::class);
    }

    public function saleInvoice()
    {
        return $this->belongsTo(SaleInvoice::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

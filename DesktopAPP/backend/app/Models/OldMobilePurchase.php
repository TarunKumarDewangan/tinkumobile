<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

use App\Traits\RecordsTransactions;

class OldMobilePurchase extends Model
{
    use RecordsTransactions, \App\Traits\MirrorsToSupabase;
    protected $fillable = [
        'shop_id', 'customer_id', 'product_id', 'model_name', 'imei', 'ram', 'storage', 'color', 'purchase_price', 'selling_price', 'is_exchange', 'exchange_credit_mode', 'exchange_credit_amount', 'pay_later', 'condition_note', 'purchase_date', 'user_id', 'batch_id',
        'exchange_issue_resolved_at', 'exchange_issue_resolution', 'exchange_issue_note', 'exchange_issue_resolved_by',
    ];

    protected $casts = [
        'is_exchange' => 'boolean',
        'pay_later' => 'boolean',
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'exchange_credit_amount' => 'decimal:2',
        'exchange_issue_resolved_at' => 'datetime',
    ];

    public function shop(): BelongsTo { return $this->belongsTo(Shop::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function exchangeIssueResolvedBy(): BelongsTo { return $this->belongsTo(User::class, 'exchange_issue_resolved_by'); }

    /** Polymorphic-style link used by Transaction (entity_type/entity_id), not a real Eloquent polymorphic relation. */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'entity_id')->where('entity_type', self::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category_id', 'name', 'sku', 'imei', 'purchase_price', 'selling_price', 'condition', 'attributes', 'location'
    ];

    protected $casts = [
        'attributes' => 'array',
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
    ];

    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function inventory(): HasMany { return $this->hasMany(Inventory::class); }
    public function purchaseItems(): HasMany { return $this->hasMany(PurchaseItem::class); }
    public function saleItems(): HasMany { return $this->hasMany(SaleItem::class); }
    public function incentives(): HasMany { return $this->hasMany(EmployeeIncentive::class); }
    public function companyOffers(): HasMany { return $this->hasMany(CompanyOffer::class); }

    /** Get stock for a specific shop */
    public function stockForShop(int $shopId): int
    {
        $inv = $this->inventory()->where('shop_id', $shopId)->first();
        return $inv ? $inv->stock : 0;
    }
}

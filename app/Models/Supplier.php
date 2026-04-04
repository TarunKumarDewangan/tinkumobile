<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $fillable = ['name', 'phone', 'address', 'is_online_shop'];
    protected $casts = ['is_online_shop' => 'boolean'];

    public function purchaseInvoices(): HasMany { return $this->hasMany(PurchaseInvoice::class); }
    public function rechargeP(): HasMany { return $this->hasMany(RechargePurchase::class); }
    public function simCards(): HasMany { return $this->hasMany(SimCard::class, 'purchased_from'); }
}

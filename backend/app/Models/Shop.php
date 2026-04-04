<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shop extends Model
{
    protected $fillable = ['name', 'address', 'phone', 'email', 'is_main'];

    protected $casts = ['is_main' => 'boolean'];

    public function users(): HasMany { return $this->hasMany(User::class); }
    public function inventory(): HasMany { return $this->hasMany(Inventory::class); }
    public function purchaseInvoices(): HasMany { return $this->hasMany(PurchaseInvoice::class); }
    public function saleInvoices(): HasMany { return $this->hasMany(SaleInvoice::class); }
    public function repairRequests(): HasMany { return $this->hasMany(RepairRequest::class); }
    public function rechargeP(): HasMany { return $this->hasMany(RechargePurchase::class); }
    public function rechargeS(): HasMany { return $this->hasMany(RechargeSale::class); }
    public function simCards(): HasMany { return $this->hasMany(SimCard::class); }
    public function oldMobilePurchases(): HasMany { return $this->hasMany(OldMobilePurchase::class); }
    public function giftInventory(): HasMany { return $this->hasMany(GiftInventory::class); }
}

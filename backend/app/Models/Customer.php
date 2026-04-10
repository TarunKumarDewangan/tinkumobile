<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes, UppercaseStrings;

    protected $fillable = ['name', 'phone', 'email', 'address', 'voucher_code'];

    public function events(): HasMany { return $this->hasMany(CustomerEvent::class); }
    public function rechargeS(): HasMany { return $this->hasMany(RechargeSale::class); }
    public function simCards(): HasMany { return $this->hasMany(SimCard::class, 'sold_to'); }
    public function oldMobilePurchases(): HasMany { return $this->hasMany(OldMobilePurchase::class); }
    public function followUps(): HasMany { return $this->hasMany(FollowUp::class); }
    public function loans(): HasMany { return $this->hasMany(Loan::class); }
}

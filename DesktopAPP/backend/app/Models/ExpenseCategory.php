<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExpenseCategory extends Model
{
    use SoftDeletes, UppercaseStrings;

    protected $fillable = ['shop_id', 'name', 'description'];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function transactions()
    {
        return $this->morphMany(Transaction::class, 'entity');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'name',
        'phone',
        'email',
        'address',
        'join_date',
        'base_salary',
        'total_incentives',
        'designation',
        'is_active',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'total_incentives' => 'decimal:2',
        'is_active' => 'boolean',
        'join_date' => 'date',
    ];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function salaryPayments()
    {
        return $this->hasMany(SalaryPayment::class);
    }
}

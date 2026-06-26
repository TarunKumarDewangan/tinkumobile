<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory, UppercaseStrings;

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($employee) {
            if (empty($employee->emp_id)) {
                $employee->emp_id = \App\Services\EmployeeIdService::generate($employee->shop_id);
            }
        });
    }

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
        'emp_id',
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

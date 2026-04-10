<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, HasRoles, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'shop_id', 'is_owner',
        'phone', 'address', 'designation', 'base_salary', 'joining_date', 'aadhaar_no', 'status'
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_owner' => 'boolean',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    /** Owner bypasses all permission checks */
    public function isOwner(): bool
    {
        return (bool) $this->is_owner;
    }

    /** Admin role check */
    public function isAdmin(): bool
    {
        return $this->hasRole('Admin');
    }

    /** Full system access (Owner or Admin) */
    public function hasFullAccess(): bool
    {
        return $this->isOwner() || $this->isAdmin();
    }

    /** Manager role check */
    public function isManager(): bool
    {
        return $this->hasRole('manager');
    }

    /** Shop scope helper for controllers */
    public function getShopId(): ?int
    {
        return $this->shop_id;
    }

    public function salaryPayments()
    {
        return $this->hasMany(SalaryPayment::class, 'user_id');
    }
}

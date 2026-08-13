<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class Category extends Model
{
    use UppercaseStrings, \App\Traits\MirrorsToSupabase;
    protected $fillable = ['name', 'slug'];

    public function products(): HasMany { return $this->hasMany(Product::class); }

    /**
     * Cached lookup for the "mobile new" category id. Slugs are stored
     * lowercase since the 2026_07_01 migration, but both cases are checked
     * for safety. Was previously re-queried, uncached, in ~6 hot-path spots.
     */
    public static function mobileNewId(): ?int
    {
        return Cache::remember('category_mobile_new_id', 3600, function () {
            return static::whereIn('slug', ['MOBILE-NEW', 'mobile-new'])->value('id');
        });
    }

    /** Cached lookup for the "mobile old" (second-hand) category id. */
    public static function mobileOldId(): ?int
    {
        return Cache::remember('category_mobile_old_id', 3600, function () {
            return static::whereIn('slug', ['MOBILE-OLD', 'mobile-old'])->value('id');
        });
    }
}

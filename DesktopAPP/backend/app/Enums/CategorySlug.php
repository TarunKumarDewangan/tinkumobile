<?php

namespace App\Enums;

/**
 * Centralized category slug constants.
 * Replace raw string comparisons across controllers with these enum values.
 */
enum CategorySlug: string
{
    case OldMobile = 'mobile-old';
    case NewMobile = 'mobile-new';

    /**
     * Get all known mobile-related slugs for loose matching.
     */
    public static function mobileSlugs(): array
    {
        return [
            self::OldMobile->value,
            strtoupper(self::OldMobile->value),
            self::NewMobile->value,
            strtoupper(self::NewMobile->value),
        ];
    }
}

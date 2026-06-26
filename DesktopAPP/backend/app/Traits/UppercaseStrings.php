<?php

namespace App\Traits;

trait UppercaseStrings
{
    protected static function bootUppercaseStrings()
    {
        static::saving(function ($model) {
            foreach ($model->getAttributes() as $key => $value) {
                if (is_string($value) && $model->isFillable($key)) {
                    if (!in_array($key, ['email', 'password', 'remember_token', 'token', 'payment_mode', 'attributes', 'imei', 'imeis', 'relation_type'])) {
                        $model->{$key} = strtoupper($value);
                    }
                }
            }
        });
    }
}

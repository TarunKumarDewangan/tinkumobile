<?php

namespace App\Traits;

use App\Models\Entity;
use App\Services\EntityService;

trait SyncsBalances
{
    public static function bootSyncsBalances()
    {
        static::saved(function ($model) {
            static::syncRelatedEntity($model);
        });

        static::deleted(function ($model) {
            static::syncRelatedEntity($model);
        });
    }

    protected static function syncRelatedEntity($model)
    {
        // 1. Primary: Use accounting_entity_id if available
        if (isset($model->accounting_entity_id)) {
            $entity = Entity::find($model->accounting_entity_id);
            if ($entity) {
                app(EntityService::class)->syncBalance($entity);
            }
            return;
        }

        // 2. Legacy/Fallback: Try to find entity name from common fields
        $entityName = null;
        if (isset($model->entity_name)) {
            $entityName = $model->entity_name;
        } elseif (isset($model->customer) && isset($model->customer->name)) {
            $entityName = $model->customer->name;
        } elseif (isset($model->supplier) && isset($model->supplier->name)) {
            $entityName = $model->supplier->name;
        }

        if ($entityName) {
            $entity = Entity::where('name', $entityName)->first();
            if ($entity) {
                app(EntityService::class)->syncBalance($entity);
            }
        }
        
        if (isset($model->forwarded_to)) {
            $fwdEntity = Entity::where('name', $model->forwarded_to)->first();
            if ($fwdEntity) {
                app(EntityService::class)->syncBalance($fwdEntity);
            }
        }
    }
}

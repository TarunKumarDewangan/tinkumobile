<?php

namespace App\Models;

use App\Traits\UppercaseStrings;
use Illuminate\Database\Eloquent\Model;

class Subcategory extends Model
{
    use UppercaseStrings;

    protected $fillable = ['name'];
}

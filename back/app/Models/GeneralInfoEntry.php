<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GeneralInfoEntry extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'title',
        'body',
        'author_id',
        'author_name',
        'author_role',
        'image_data',
        'image_alt',
    ];

    protected static function booted(): void
    {
        static::creating(function (GeneralInfoEntry $model): void {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }
}

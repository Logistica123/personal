<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FileType extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'fyle_types';

    protected $fillable = [
        'nombre',
        'vence',
    ];

    protected $casts = [
        'vence' => 'boolean',
    ];
}


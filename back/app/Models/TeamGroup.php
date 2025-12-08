<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeamGroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'color',
    ];

    public function members()
    {
        return $this->hasMany(TeamGroupMember::class);
    }
}

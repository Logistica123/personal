<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeamGroupMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_group_id',
        'user_id',
        'name',
        'email',
    ];

    public function group()
    {
        return $this->belongsTo(TeamGroup::class, 'team_group_id');
    }
}

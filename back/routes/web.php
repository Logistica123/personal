<?php

use App\Http\Controllers\Api\PersonalController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/r/{code}', [PersonalController::class, 'redirectTransportistaQr'])
    ->where('code', '[A-Za-z0-9\-]+')
    ->name('transportista.qr.redirect');

<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\UnidadController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PersonalController;
use App\Http\Controllers\Api\ReclamoController;
use App\Http\Controllers\Api\NotificationController;
use Illuminate\Support\Facades\Route;

Route::get('/clientes', [ClienteController::class, 'index']);
Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
Route::post('/clientes', [ClienteController::class, 'store']);
Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);

Route::get('/unidades', [UnidadController::class, 'index']);
Route::post('/unidades', [UnidadController::class, 'store']);
Route::get('/unidades/{unidad}', [UnidadController::class, 'show']);
Route::put('/unidades/{unidad}', [UnidadController::class, 'update']);
Route::delete('/unidades/{unidad}', [UnidadController::class, 'destroy']);

Route::get('/usuarios', [UserController::class, 'index']);
Route::post('/usuarios', [UserController::class, 'store']);
Route::get('/usuarios/{usuario}', [UserController::class, 'show']);
Route::put('/usuarios/{usuario}', [UserController::class, 'update']);
Route::delete('/usuarios/{usuario}', [UserController::class, 'destroy']);

Route::get('/personal', [PersonalController::class, 'index']);
Route::get('/personal/{persona}', [PersonalController::class, 'show']);
Route::put('/personal/{persona}', [PersonalController::class, 'update']);
Route::post('/personal/{persona}/documentos', [PersonalController::class, 'storeDocument']);
Route::post('/personal', [PersonalController::class, 'store']);
Route::get('/personal-meta', [PersonalController::class, 'meta']);

Route::post('/login', [AuthController::class, 'login']);

Route::get('/reclamos/meta', [ReclamoController::class, 'meta']);
Route::get('/reclamos', [ReclamoController::class, 'index']);
Route::post('/reclamos', [ReclamoController::class, 'store']);
Route::get('/reclamos/{reclamo}', [ReclamoController::class, 'show']);
Route::put('/reclamos/{reclamo}', [ReclamoController::class, 'update']);
Route::get('/notificaciones', [NotificationController::class, 'index']);
Route::post('/notificaciones/{notification}/leer', [NotificationController::class, 'markAsRead']);
Route::get('/notificaciones', [NotificationController::class, 'index']);
Route::post('/notificaciones/{notification}/leer', [NotificationController::class, 'markAsRead']);
Route::get('/reclamos/{reclamo}/documentos/{documento}/descargar', [ReclamoController::class, 'downloadDocument']);
Route::post('/reclamos/{reclamo}/comments', [ReclamoController::class, 'storeComment']);
Route::post('/reclamos/{reclamo}/documentos', [ReclamoController::class, 'storeDocument']);

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');

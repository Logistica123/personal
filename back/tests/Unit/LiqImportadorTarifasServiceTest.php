<?php

namespace Tests\Unit;

use App\Services\Liq\LiqImportadorTarifasService;
use PHPUnit\Framework\TestCase;

/**
 * SPEC "Importador de Tarifas OCASA" v1.0 — tests unitarios focalizados.
 *
 * Testea la lógica pura del servicio (parsers, validación, normalización) vía reflection.
 * Los tests de integración con DB requieren setup de migraciones pesado y quedan pendientes
 * para Feature tests cuando se armen fixtures completos.
 */
class LiqImportadorTarifasServiceTest extends TestCase
{
    private LiqImportadorTarifasService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new LiqImportadorTarifasService();
    }

    private function invoke(string $method, array $args = []): mixed
    {
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod($method);
        $m->setAccessible(true);
        return $m->invokeArgs($this->svc, $args);
    }

    public function test_normHeader_convierte_acentos_y_caracteres_especiales(): void
    {
        $this->assertSame('ruta_codigo', $this->invoke('normHeader', ['Ruta Código']));
        $this->assertSame('porcentaje_pct', $this->invoke('normHeader', ['Porcentaje %']));
        $this->assertSame('capacidad_vehiculo', $this->invoke('normHeader', ['Capacidad-Vehículo']));
        $this->assertSame('factor_km', $this->invoke('normHeader', ['  FACTOR_KM  ']));
    }

    public function test_normModelo_acepta_mayusculas_minusculas_y_mezclado(): void
    {
        $this->assertSame('Jornada',        $this->invoke('normModelo', ['jornada']));
        $this->assertSame('Jornada_KM',     $this->invoke('normModelo', ['JORNADA_KM']));
        $this->assertSame('Productividad',  $this->invoke('normModelo', ['Productividad']));
        // Inválido: se devuelve tal cual, la validación lo detectará
        $this->assertSame('fake_modelo',    $this->invoke('normModelo', ['fake_modelo']));
    }

    public function test_parseDecimal_formato_AR_con_coma_decimal(): void
    {
        $this->assertEqualsWithDelta(212579.64, $this->invoke('parseDecimal', ['212.579,64']), 0.001);
        $this->assertEqualsWithDelta(1234.56,   $this->invoke('parseDecimal', ['1.234,56']), 0.001);
        $this->assertEqualsWithDelta(0.8147,    $this->invoke('parseDecimal', ['0,8147']), 0.00001);
    }

    public function test_parseDecimal_formato_US_con_punto_decimal(): void
    {
        $this->assertEqualsWithDelta(212579.64, $this->invoke('parseDecimal', ['212,579.64']), 0.001);
        $this->assertEqualsWithDelta(1234.56,   $this->invoke('parseDecimal', ['1,234.56']), 0.001);
        $this->assertEqualsWithDelta(0.8147,    $this->invoke('parseDecimal', ['0.8147']), 0.00001);
    }

    public function test_parseDecimal_vacio_devuelve_null(): void
    {
        $this->assertNull($this->invoke('parseDecimal', [null]));
        $this->assertNull($this->invoke('parseDecimal', ['']));
        $this->assertNull($this->invoke('parseDecimal', ['texto no numerico']));
    }

    public function test_parseInt_acepta_enteros_y_string_numerico(): void
    {
        $this->assertSame(7500, $this->invoke('parseInt', [7500]));
        $this->assertSame(7500, $this->invoke('parseInt', ['7500']));
        $this->assertSame(7500, $this->invoke('parseInt', ['7500.0']));
        $this->assertNull($this->invoke('parseInt', [null]));
        $this->assertNull($this->invoke('parseInt', ['']));
    }

    public function test_parseBoolStrict_acepta_varios_formatos(): void
    {
        $err = null;
        $this->assertTrue($this->invoke('parseBoolStrict', [1, &$err]));
        $this->assertTrue($this->invoke('parseBoolStrict', ['1', &$err]));
        $this->assertTrue($this->invoke('parseBoolStrict', ['si', &$err]));
        $this->assertTrue($this->invoke('parseBoolStrict', ['SÍ', &$err]));
        $this->assertTrue($this->invoke('parseBoolStrict', [true, &$err]));

        $this->assertFalse($this->invoke('parseBoolStrict', [0, &$err]));
        $this->assertFalse($this->invoke('parseBoolStrict', ['0', &$err]));
        $this->assertFalse($this->invoke('parseBoolStrict', ['no', &$err]));
        $this->assertFalse($this->invoke('parseBoolStrict', [false, &$err]));
    }

    public function test_parseBoolStrict_rechaza_valores_ambiguos(): void
    {
        $err = null;
        $this->invoke('parseBoolStrict', [2, &$err]);
        $this->assertNotNull($err);
        $this->assertStringContainsString('inválido', $err);

        $err = null;
        $this->invoke('parseBoolStrict', ['tal vez', &$err]);
        $this->assertNotNull($err);
    }

    public function test_parseDate_acepta_iso_y_formato_AR(): void
    {
        $this->assertSame('2026-02-01', $this->invoke('parseDate', ['2026-02-01']));
        $this->assertSame('2026-02-01', $this->invoke('parseDate', ['01/02/2026']));
        $this->assertNull($this->invoke('parseDate', [null]));
        $this->assertNull($this->invoke('parseDate', ['']));
    }

    public function test_validarFilaTarifa_override_sin_distribuidor_ni_patente_falla(): void
    {
        $f = [
            '_errores' => [], '_warnings' => [],
            'capacidad_vehiculo' => 2500,
            'precio_original' => 100000,
            'precio_distribuidor' => 90000,
            'porcentaje_agencia' => 10,
            'modelo_tarifa' => 'Jornada_KM',
            'es_tarifa_base' => false,
            'distribuidor_nombre' => null,
            'patente_match' => null,
            'factor_km' => null,
        ];
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod('validarFilaTarifa');
        $m->setAccessible(true);
        $m->invokeArgs($this->svc, [&$f]);

        $this->assertNotEmpty($f['_errores']);
        $this->assertStringContainsString('distribuidor_nombre o patente_match', implode(' ', $f['_errores']));
    }

    public function test_validarFilaTarifa_override_con_patente_pasa(): void
    {
        $f = [
            '_errores' => [], '_warnings' => [],
            'capacidad_vehiculo' => 7500,
            'precio_original' => 212579.64,
            'precio_distribuidor' => 172087.60,
            'porcentaje_agencia' => 19,
            'modelo_tarifa' => 'Jornada_KM',
            'es_tarifa_base' => false,
            'distribuidor_nombre' => null,
            'patente_match' => 'PAL831',
            'factor_km' => 0.8147,
        ];
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod('validarFilaTarifa');
        $m->setAccessible(true);
        $m->invokeArgs($this->svc, [&$f]);

        $this->assertEmpty($f['_errores']);
    }

    public function test_validarFilaTarifa_warning_coherencia_matematica(): void
    {
        // precio_original=100, %=10 → esperado=90, distribuidor=50 (desvio grande)
        $f = [
            '_errores' => [], '_warnings' => [],
            'capacidad_vehiculo' => 7500,
            'precio_original' => 100000,
            'precio_distribuidor' => 50000, // no coincide
            'porcentaje_agencia' => 10,
            'modelo_tarifa' => 'Jornada',
            'es_tarifa_base' => true,
            'distribuidor_nombre' => null,
            'patente_match' => null,
            'factor_km' => null,
        ];
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod('validarFilaTarifa');
        $m->setAccessible(true);
        $m->invokeArgs($this->svc, [&$f]);

        $this->assertEmpty($f['_errores']);      // no es error
        $this->assertNotEmpty($f['_warnings']);  // pero sí warning
        $this->assertStringContainsString('no coincide', implode(' ', $f['_warnings']));
    }

    public function test_validarFilaTarifa_modelo_invalido_falla(): void
    {
        $f = [
            '_errores' => [], '_warnings' => [],
            'capacidad_vehiculo' => 7500,
            'precio_original' => 100,
            'precio_distribuidor' => 90,
            'porcentaje_agencia' => 10,
            'modelo_tarifa' => 'ModeloInventado',
            'es_tarifa_base' => true,
            'distribuidor_nombre' => null,
            'patente_match' => null,
            'factor_km' => null,
        ];
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod('validarFilaTarifa');
        $m->setAccessible(true);
        $m->invokeArgs($this->svc, [&$f]);

        $this->assertNotEmpty($f['_errores']);
        $this->assertStringContainsString('modelo_tarifa inválido', implode(' ', $f['_errores']));
    }

    public function test_validarFilaTarifa_factor_km_fuera_de_rango_falla(): void
    {
        $f = [
            '_errores' => [], '_warnings' => [],
            'capacidad_vehiculo' => 7500,
            'precio_original' => 100,
            'precio_distribuidor' => 90,
            'porcentaje_agencia' => 10,
            'modelo_tarifa' => 'Jornada_KM',
            'es_tarifa_base' => false,
            'distribuidor_nombre' => 'Walter',
            'patente_match' => null,
            'factor_km' => 1.5, // fuera de [0,1]
        ];
        $ref = new \ReflectionClass($this->svc);
        $m = $ref->getMethod('validarFilaTarifa');
        $m->setAccessible(true);
        $m->invokeArgs($this->svc, [&$f]);

        $this->assertNotEmpty($f['_errores']);
        $this->assertStringContainsString('factor_km', implode(' ', $f['_errores']));
    }

    public function test_detectarTipoImport_clasifica_correctamente(): void
    {
        $this->assertSame('tarifas',    $this->invoke('detectarTipoImport', [[['x']], [], []]));
        $this->assertSame('motivos',    $this->invoke('detectarTipoImport', [[], [['x']], []]));
        $this->assertSame('materiales', $this->invoke('detectarTipoImport', [[], [], [['x']]]));
        $this->assertSame('combinado',  $this->invoke('detectarTipoImport', [[['x']], [['y']], []]));
        $this->assertSame('combinado',  $this->invoke('detectarTipoImport', [[['x']], [['y']], [['z']]]));
    }
}

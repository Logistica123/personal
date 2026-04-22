<?php

namespace Tests\Unit;

use App\Services\Liq\LiqPlantillaImportBuilder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PHPUnit\Framework\TestCase;

class LiqPlantillaImportBuilderTest extends TestCase
{
    public function test_build_genera_xlsx_con_las_cuatro_hojas(): void
    {
        $builder = new LiqPlantillaImportBuilder();
        $path = $builder->build('OCASA');

        $this->assertFileExists($path);
        $this->assertGreaterThan(100, filesize($path));

        $sheet = IOFactory::load($path);
        $names = $sheet->getSheetNames();

        $this->assertContains('Instrucciones', $names);
        $this->assertContains('Tarifas',        $names);
        $this->assertContains('Motivos',        $names);
        $this->assertContains('Materiales',     $names);

        // Tarifas: verificar headers
        $tarifas = $sheet->getSheetByName('Tarifas');
        $header = $tarifas->rangeToArray('A1:Q1')[0];
        $this->assertContains('ruta',               $header);
        $this->assertContains('capacidad_vehiculo', $header);
        $this->assertContains('es_tarifa_base',     $header);
        $this->assertContains('distribuidor_nombre', $header);
        $this->assertContains('patente_match',      $header);
        $this->assertContains('motivo',             $header);

        // Motivos: verificar headers
        $motivos = $sheet->getSheetByName('Motivos');
        $headerMot = $motivos->rangeToArray('A1:D1')[0];
        $this->assertContains('cliente_codigo', $headerMot);
        $this->assertContains('codigo',         $headerMot);
        $this->assertContains('es_exitoso',     $headerMot);

        // Materiales: verificar headers
        $materiales = $sheet->getSheetByName('Materiales');
        $headerMat = $materiales->rangeToArray('A1:D1')[0];
        $this->assertContains('cliente_codigo',     $headerMat);
        $this->assertContains('codigo_ycc',         $headerMat);
        $this->assertContains('material_tarifario', $headerMat);

        @unlink($path);
    }

    public function test_build_usa_cliente_codigo_provisto(): void
    {
        $builder = new LiqPlantillaImportBuilder();
        $path = $builder->build('URBANO');

        $sheet = IOFactory::load($path);
        $motivos = $sheet->getSheetByName('Motivos');
        $cell = $motivos->getCell('A2')->getValue();
        $this->assertSame('URBANO', $cell);

        @unlink($path);
    }
}

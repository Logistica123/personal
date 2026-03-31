<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\CierreDiarioController;
use PHPUnit\Framework\TestCase;

class CierreDiarioImportTest extends TestCase
{
    public function test_it_maps_common_kommo_excel_headers_and_computes_date_parts(): void
    {
        $rows = [
            [
                'ID',
                'Contacto principal',
                'Responsable',
                'Estatus del lead',
                'Embudo de ventas',
                'Fecha de Creación',
                'Empresa',
                'Compañía',
                'Teléfono oficina (contacto)',
            ],
            [
                '21603757',
                'Marcelo Jazmin',
                'Juan Perez',
                'Leads Entrantes',
                'Ariel',
                '26.03.2026 19:18:21',
                '',
                'Mi Empresa SA',
                "'+5493425562518",
            ],
        ];

        $controller = new CierreDiarioController();
        $ref = new \ReflectionClass($controller);
        $method = $ref->getMethod('normalizeImportedRows');
        $method->setAccessible(true);

        $records = $method->invoke($controller, $rows);

        $this->assertCount(1, $records);
        $record = $records[0];

        $this->assertSame(21603757, $record['lead_id']);
        $this->assertSame('+5493425562518', $record['contacto']);
        $this->assertSame('Leads Entrantes', $record['estatus_lead']);
        $this->assertSame('Ariel', $record['embudo']);
        $this->assertSame('Juan Perez', $record['asesor_comercial']);
        $this->assertSame('Mi Empresa SA', $record['empresa']);

        $this->assertNotNull($record['fecha_lead']);
        $this->assertSame('2026-03-26', $record['fecha_lead']->toDateString());
        $this->assertSame(3, $record['mes']);
        $this->assertSame(4, $record['semana']);
        $this->assertSame(26, $record['dia']);
    }
}

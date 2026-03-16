<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_clientes_facturacion_consolidado');

        DB::statement(
            <<<SQL
            CREATE VIEW vw_clientes_facturacion_consolidado AS
            SELECT
                fc.cliente_id,
                c.nombre AS cliente_nombre,
                fc.sucursal_id,
                s.nombre AS sucursal_nombre,
                fc.anio_facturado,
                fc.mes_facturado,
                fc.periodo_facturado,
                COUNT(*) AS cantidad_facturas,
                SUM(COALESCE(fc.imp_neto, 0)) AS total_neto_gravado,
                SUM(COALESCE(fc.imp_tot_conc, 0) + COALESCE(fc.imp_op_ex, 0)) AS total_no_gravado,
                SUM(COALESCE(fc.imp_iva, 0)) AS total_iva,
                SUM(COALESCE(fc.imp_total, 0)) AS total_final,
                MIN(fc.fecha_aprox_cobro) AS primera_fecha_aprox_cobro,
                MAX(fc.fecha_aprox_cobro) AS ultima_fecha_aprox_cobro,
                MAX(fc.fecha_pago_manual) AS ultima_fecha_pago,
                SUM(CASE WHEN fc.estado_cobranza = 'COBRADA' THEN 1 ELSE 0 END) AS facturas_cobradas,
                SUM(CASE WHEN fc.estado_cobranza = 'VENCIDA' THEN 1 ELSE 0 END) AS facturas_vencidas,
                SUM(CASE WHEN fc.estado_cobranza IN ('PENDIENTE', 'A_VENCER', 'PARCIAL') THEN 1 ELSE 0 END) AS facturas_pendientes
            FROM factura_cabecera fc
            INNER JOIN clientes c ON c.id = fc.cliente_id
            INNER JOIN sucursals s ON s.id = fc.sucursal_id
            GROUP BY
                fc.cliente_id,
                c.nombre,
                fc.sucursal_id,
                s.nombre,
                fc.anio_facturado,
                fc.mes_facturado,
                fc.periodo_facturado
            SQL
        );
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_clientes_facturacion_consolidado');
    }
};

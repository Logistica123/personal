<?php

namespace App\Services\Oca;

use App\Models\LiqArchivoEntrada;
use App\Models\LiqLiquidacionCliente;
use App\Models\LiqVinculacionOca;
use App\Models\Persona;
use App\Support\Personal\PersonaPatenteHelper;
use Illuminate\Http\UploadedFile;
use RuntimeException;

/**
 * Orquesta el procesamiento OCA:
 * 1. Envía PDFs al microservicio Python
 * 2. Guarda vinculaciones en liq_vinculaciones_oca
 * 3. Crea operaciones en liq_operaciones (reutilizando estructura existente)
 */
class OcaIngestService
{
    public function __construct(
        private readonly OcaClient $ocaClient,
    ) {}

    /**
     * Procesa los archivos OCA subidos para una liquidación.
     *
     * @param LiqLiquidacionCliente $liquidacion Liquidación padre
     * @param LiqArchivoEntrada $archivoPrincipal Archivo entrada del PDF principal
     * @param LiqArchivoEntrada[] $archivosDistrib Archivos entrada de distribuidores
     * @param UploadedFile $mainPdf PDF principal subido
     * @param UploadedFile[] $distribPdfs PDFs de distribuidores subidos
     * @param string $sucursal Código de sucursal
     * @return array Resumen del procesamiento
     */
    public function procesar(
        LiqLiquidacionCliente $liquidacion,
        LiqArchivoEntrada $archivoPrincipal,
        array $archivosDistrib,
        UploadedFile $mainPdf,
        array $distribPdfs,
        string $sucursal,
    ): array {
        // 1. Verificar que el servicio Python está disponible
        if (! $this->ocaClient->isAvailable()) {
            throw new RuntimeException(
                'El servicio de procesamiento OCA no está disponible. '
                . 'Verificá que el microservicio Python esté corriendo en '
                . config('services.oca.base_url')
            );
        }

        // 2. Enviar al microservicio Python
        $resultado = $this->ocaClient->procesar($sucursal, $mainPdf, $distribPdfs);

        if (empty($resultado)) {
            throw new RuntimeException('El servicio OCA devolvió un resultado vacío');
        }

        // 3. Guardar vinculaciones en la DB
        $stats = $this->guardarVinculaciones($liquidacion, $resultado, $sucursal);

        // 4. Actualizar archivos de entrada
        $archivoPrincipal->update([
            'sucursal' => $sucursal,
            'cant_registros' => $resultado['total_planillas'] ?? 0,
        ]);

        return [
            'sucursal' => $sucursal,
            'formato_distribuidor' => $resultado['formato_distribuidor'] ?? null,
            'total_planillas' => $resultado['total_planillas'] ?? 0,
            'total_distribuidores' => $resultado['total_distribuidores'] ?? 0,
            'dias_procesados' => count($resultado['dias'] ?? []),
            'vinculaciones_creadas' => $stats['creadas'],
            'exactos' => $stats['exactos'],
            'aproximados' => $stats['aproximados'],
            'sin_asignar' => $stats['sin_asignar'],
        ];
    }

    /**
     * Guarda las vinculaciones del resultado Python en la tabla liq_vinculaciones_oca.
     */
    private function guardarVinculaciones(
        LiqLiquidacionCliente $liquidacion,
        array $resultado,
        string $sucursal,
    ): array {
        // Limpiar vinculaciones previas de esta liquidación
        LiqVinculacionOca::where('liquidacion_cliente_id', $liquidacion->id)->delete();

        $stats = ['creadas' => 0, 'exactos' => 0, 'aproximados' => 0, 'sin_asignar' => 0];

        foreach ($resultado['dias'] ?? [] as $dia) {
            // Planillas asignadas
            foreach ($dia['asignaciones'] ?? [] as $asignacion) {
                $planilla = $asignacion['planilla'];
                $estado = $asignacion['estado'] ?? 'SIN_ASIGNAR';

                // Intentar encontrar distribuidor en DistriApp por nombre
                $distribuidorId = $this->buscarDistribuidorPorNombre($asignacion['distribuidor_nombre'] ?? '');

                LiqVinculacionOca::create([
                    'liquidacion_cliente_id' => $liquidacion->id,
                    'fecha' => $planilla['fecha'],
                    'nro_planilla' => $planilla['nro_planilla'],
                    'cod_contrato' => $planilla['cod_contrato'],
                    'descripcion' => $planilla['descripcion'] ?? null,
                    'precio_original' => $planilla['precio_unitario'],
                    'cantidad' => $planilla['cantidad'],
                    'importe_original' => $planilla['importe_total'],
                    'distribuidor_id' => $distribuidorId,
                    'distribuidor_nombre' => $asignacion['distribuidor_nombre'] ?? null,
                    'match_score' => $asignacion['score'] ?? 0,
                    'estado' => $estado,
                    'formato_origen' => $resultado['formato_distribuidor'] ?? null,
                    'sucursal' => $sucursal,
                ]);

                $stats['creadas']++;
                if ($estado === 'EXACTO') {
                    $stats['exactos']++;
                } elseif ($estado === 'APROXIMADO') {
                    $stats['aproximados']++;
                }
            }

            // Planillas sin asignar
            foreach ($dia['sin_asignar'] ?? [] as $planilla) {
                LiqVinculacionOca::create([
                    'liquidacion_cliente_id' => $liquidacion->id,
                    'fecha' => $planilla['fecha'],
                    'nro_planilla' => $planilla['nro_planilla'],
                    'cod_contrato' => $planilla['cod_contrato'],
                    'descripcion' => $planilla['descripcion'] ?? null,
                    'precio_original' => $planilla['precio_unitario'],
                    'cantidad' => $planilla['cantidad'],
                    'importe_original' => $planilla['importe_total'],
                    'estado' => 'SIN_ASIGNAR',
                    'formato_origen' => $resultado['formato_distribuidor'] ?? null,
                    'sucursal' => $sucursal,
                ]);

                $stats['creadas']++;
                $stats['sin_asignar']++;
            }
        }

        return $stats;
    }

    /**
     * Busca un distribuidor en DistriApp por nombre (fuzzy).
     */
    private function buscarDistribuidorPorNombre(string $nombre): ?int
    {
        if (trim($nombre) === '') {
            return null;
        }

        // Intentar match por apellido o nombre
        $parts = preg_split('/\s+/', trim($nombre), 2);
        $query = Persona::where('tipo', 'transportista');
        if (count($parts) >= 2) {
            $query->where(function ($q) use ($parts) {
                $q->where(function ($q2) use ($parts) {
                    $q2->where('apellidos', 'LIKE', '%' . $parts[0] . '%')
                        ->where('nombres', 'LIKE', '%' . $parts[1] . '%');
                })->orWhere(function ($q2) use ($parts) {
                    $q2->where('apellidos', 'LIKE', '%' . $parts[1] . '%')
                        ->where('nombres', 'LIKE', '%' . $parts[0] . '%');
                });
            });
        } else {
            $query->where(function ($q) use ($nombre) {
                $q->where('apellidos', 'LIKE', '%' . $nombre . '%')
                  ->orWhere('nombres', 'LIKE', '%' . $nombre . '%');
            });
        }
        $persona = $query->first();

        return $persona?->id;
    }
}

<?php

namespace App\Services\Polizas;

use App\Models\Archivo;
use App\Models\PolizaAsegurado;
use App\Models\PolizaClausula;
use App\Models\PolizaClausulaAplicada;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * ADDENDUM 9 Parte B — genera el PDF "Certificado individual" del distribuidor
 * cuando se confirma su alta en una póliza, y lo guarda en `archivos` con
 * `categoria='poliza_individual'` para que aparezca en su sección Documentos.
 *
 * El PDF NO incluye importes (suma asegurada, premio, franquicia) — sólo datos
 * de identidad, cobertura y cláusulas aplicadas.
 */
class PolizaCertificadoIndividualService
{
    public const CATEGORIA = 'poliza_individual';

    /**
     * Renderiza el PDF (binario) para un asegurado dado. Lanza si no hay persona
     * vinculada — el certificado no se puede emitir sin distribuidor.
     */
    public function renderPdf(PolizaAsegurado $asegurado): string
    {
        $asegurado->loadMissing([
            'persona:id,apellidos,nombres,cuil',
            'poliza:id,numero_poliza,subramo,ramo,vigencia_hasta,aseguradora_id',
            'poliza.aseguradora:id,nombre',
        ]);

        if (!$asegurado->persona) {
            throw new RuntimeException(
                "PolizaAsegurado {$asegurado->id} no tiene persona vinculada — no se puede emitir certificado."
            );
        }

        $persona = $asegurado->persona;
        $poliza = $asegurado->poliza;

        $dni = MatchingService::extraerDniDeCuil($persona->cuil);
        $fechaNac = $asegurado->fecha_nacimiento_pdf
            ? Carbon::parse($asegurado->fecha_nacimiento_pdf)->format('d/m/Y')
            : null;

        $clausulas = $this->clausulasVigentes($asegurado);

        $html = view('polizas.certificado_individual', [
            'persona'          => $persona,
            'poliza'           => $poliza,
            'asegurado'        => $asegurado,
            'dni'              => $dni,
            'fecha_nacimiento' => $fechaNac,
            'ramo_legible'     => $this->ramoLegible($poliza?->ramo),
            'clausulas'        => $clausulas,
            'fecha_generacion' => Carbon::now()->format('d/m/Y'),
        ])->render();

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    /**
     * Genera el PDF y lo persiste en `archivos` (disk default) con
     * `categoria='poliza_individual'`. Reusa el archivo si ya existía para esta
     * misma combinación asegurado+poliza (evita duplicados ante reintentos).
     */
    public function generarYGuardar(PolizaAsegurado $asegurado): Archivo
    {
        $asegurado->loadMissing(['poliza.aseguradora']);
        if (!$asegurado->persona_id) {
            throw new RuntimeException("Asegurado {$asegurado->id} sin persona vinculada.");
        }

        $contenido = $this->renderPdf($asegurado);

        $aseguradoraSlug = preg_replace('/[^A-Za-z0-9]+/', '_', $asegurado->poliza?->aseguradora?->nombre ?? 'Aseguradora');
        $subramoSlug = preg_replace('/[^A-Za-z0-9]+/', '_', $asegurado->poliza?->subramo ?? 'Cobertura');
        $fecha = $asegurado->fecha_alta_efectiva
            ? Carbon::parse($asegurado->fecha_alta_efectiva)->format('Ymd')
            : Carbon::now()->format('Ymd');

        $nombre = "Certificado_{$aseguradoraSlug}_{$subramoSlug}_{$fecha}.pdf";
        $ruta = "personas/{$asegurado->persona_id}/polizas/{$nombre}";

        Storage::put($ruta, $contenido);

        // Si existe un certificado previo del MISMO asegurado, actualizarlo en
        // lugar de duplicar. Lo identificamos por persona+ruta.
        $archivo = Archivo::where('persona_id', $asegurado->persona_id)
            ->where('ruta', $ruta)
            ->first();

        $attrs = [
            'persona_id'      => $asegurado->persona_id,
            'categoria'       => self::CATEGORIA,
            'nombre_original' => $nombre,
            'carpeta'         => "personas/{$asegurado->persona_id}/polizas",
            'ruta'            => $ruta,
            'disk'            => config('filesystems.default'),
            'mime'            => 'application/pdf',
            'size'            => strlen($contenido),
        ];

        if ($archivo) {
            $archivo->fill($attrs)->save();
            return $archivo;
        }
        return Archivo::create($attrs);
    }

    /** @return \Illuminate\Support\Collection<int,PolizaClausula> */
    private function clausulasVigentes(PolizaAsegurado $asegurado): \Illuminate\Support\Collection
    {
        $hoy = Carbon::today();

        // Globales: aplicadas a la póliza, vigentes hoy.
        $globales = PolizaClausulaAplicada::query()
            ->where('poliza_id', $asegurado->poliza_id)
            ->where('tipo_aplicacion', 'global')
            ->where('aplicada_desde', '<=', $hoy)
            ->where(fn ($q) => $q->whereNull('aplicada_hasta')->orWhere('aplicada_hasta', '>=', $hoy))
            ->with('clausula')
            ->get()
            ->pluck('clausula')
            ->filter();

        // Individuales: del asegurado puntual.
        $individuales = \DB::table('polizas_asegurados_clausulas')
            ->where('asegurado_id', $asegurado->id)
            ->where('aplicada_desde', '<=', $hoy)
            ->where(function ($q) use ($hoy) {
                $q->whereNull('aplicada_hasta')->orWhere('aplicada_hasta', '>=', $hoy);
            })
            ->pluck('clausula_id');

        $individualesModels = $individuales->isNotEmpty()
            ? PolizaClausula::whereIn('id', $individuales)->get()
            : collect();

        return $globales->concat($individualesModels)->unique('id')->values();
    }

    private function ramoLegible(?string $ramo): string
    {
        return match ($ramo) {
            'accidentes_personales' => 'Accidentes Personales',
            'vehiculos'             => 'Vehículos',
            default                 => $ramo ?? '—',
        };
    }
}

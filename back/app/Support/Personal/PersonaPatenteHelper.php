<?php

namespace App\Support\Personal;

use App\Models\Persona;
use App\Models\PersonaPatente;
use Illuminate\Validation\ValidationException;

class PersonaPatenteHelper
{
    public static function normalize(?string $domain): ?string
    {
        if (! is_string($domain)) {
            return null;
        }

        $normalized = strtoupper(trim($domain));
        $normalized = preg_replace('/[\s\.\-]+/', '', $normalized);

        return is_string($normalized) && $normalized !== '' ? $normalized : null;
    }

    public static function sanitizeRaw(?string $domain): ?string
    {
        $normalized = self::normalize($domain);
        return $normalized !== null ? $normalized : null;
    }

    /**
     * @return string[]
     */
    public static function normalizedDomainsForPersona(Persona $persona): array
    {
        $persona->loadMissing('patentesAdicionales');

        $domains = [];
        $primary = self::normalize($persona->patente);
        if ($primary !== null) {
            $domains[] = $primary;
        }

        foreach ($persona->patentesAdicionales as $patenteAdicional) {
            $normalized = self::normalize($patenteAdicional->patente_norm ?: $patenteAdicional->patente);
            if ($normalized !== null) {
                $domains[] = $normalized;
            }
        }

        return array_values(array_unique($domains));
    }

    /**
     * @return string[]
     */
    public static function rawDomainsForPersona(Persona $persona): array
    {
        $persona->loadMissing('patentesAdicionales');

        $domains = [];
        if (is_string($persona->patente) && trim($persona->patente) !== '') {
            $domains[] = trim($persona->patente);
        }

        foreach ($persona->patentesAdicionales as $patenteAdicional) {
            if (is_string($patenteAdicional->patente) && trim($patenteAdicional->patente) !== '') {
                $domains[] = trim($patenteAdicional->patente);
            }
        }

        return array_values(array_unique($domains));
    }

    /**
     * @param iterable<string|null> $rawPatentes
     * @return string[]
     */
    public static function normalizeMany(iterable $rawPatentes, ?string $excludePrimary = null): array
    {
        $primaryNorm = self::normalize($excludePrimary);
        $normalized = [];

        foreach ($rawPatentes as $rawPatente) {
            $candidate = self::sanitizeRaw($rawPatente);
            if ($candidate === null) {
                continue;
            }
            if ($primaryNorm !== null && $candidate === $primaryNorm) {
                continue;
            }
            $normalized[] = $candidate;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param iterable<string|null> $rawPatentes
     */
    public static function syncPersonaPatentes(Persona $persona, iterable $rawPatentes): void
    {
        $normalizedAliases = self::normalizeMany($rawPatentes, $persona->patente);
        self::assertAliasesAvailable($persona, $normalizedAliases);

        $existing = $persona->patentesAdicionales()
            ->get()
            ->keyBy('patente_norm');

        $keep = [];
        foreach ($normalizedAliases as $normalizedAlias) {
            $keep[] = $normalizedAlias;
            $record = $existing->get($normalizedAlias);
            if ($record) {
                if ($record->patente !== $normalizedAlias || ! $record->activo) {
                    $record->update([
                        'patente' => $normalizedAlias,
                        'activo' => true,
                    ]);
                }
                continue;
            }

            $persona->patentesAdicionales()->create([
                'patente' => $normalizedAlias,
                'patente_norm' => $normalizedAlias,
                'activo' => true,
            ]);
        }

        if ($keep === []) {
            $persona->patentesAdicionales()->delete();
            return;
        }

        $persona->patentesAdicionales()
            ->whereNotIn('patente_norm', $keep)
            ->delete();
    }

    /**
     * @param string[] $aliases
     */
    public static function assertAliasesAvailable(Persona $persona, array $aliases): void
    {
        if ($aliases === []) {
            return;
        }

        $conflictWithPersonas = Persona::query()
            ->where('id', '!=', $persona->id)
            ->whereNotNull('patente')
            ->where(function ($query) use ($aliases) {
                foreach ($aliases as $index => $alias) {
                    $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
                    $query->{$method}(
                        "UPPER(REPLACE(REPLACE(REPLACE(IFNULL(patente,''), ' ', ''), '-', ''), '.', '')) = ?",
                        [$alias]
                    );
                }
            })
            ->pluck('patente')
            ->filter()
            ->values()
            ->all();

        if ($conflictWithPersonas !== []) {
            throw ValidationException::withMessages([
                'patentesAdicionales' => 'Una o más patentes ya están asignadas como patente principal de otro proveedor.',
            ]);
        }

        $conflictWithAliases = PersonaPatente::query()
            ->where('persona_id', '!=', $persona->id)
            ->whereIn('patente_norm', $aliases)
            ->pluck('patente')
            ->filter()
            ->values()
            ->all();

        if ($conflictWithAliases !== []) {
            throw ValidationException::withMessages([
                'patentesAdicionales' => 'Una o más patentes ya están asignadas como patente adicional de otro proveedor.',
            ]);
        }
    }

    /**
     * @param Collection<int, Persona>|iterable<Persona> $personas
     * @return array<string, Persona>
     */
    public static function personaByDomainMap(iterable $personas): array
    {
        $map = [];
        foreach ($personas as $persona) {
            if (! $persona instanceof Persona) {
                continue;
            }
            foreach (self::normalizedDomainsForPersona($persona) as $domain) {
                $map[$domain] = $persona;
            }
        }

        return $map;
    }
}

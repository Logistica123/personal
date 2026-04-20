import React from 'react';

/**
 * BUGFIX 24 B: Badge de eficiencia con color según escala:
 *   > 100%  azul     (sobrecumplimiento)
 *   90-100% verde    (excelente)
 *   75-89%  lima     (bueno)
 *   50-74%  amarillo (regular)
 *   25-49%  naranja  (malo)
 *   < 25%   rojo     (crítico)
 *   null    gris     (sin cálculo)
 *
 * Acepta tooltip con el desglose del JSON `eficiencia_detalle`.
 */
export function EficienciaBadge({
  pct,
  detalle,
  calculadaAt,
}: {
  pct: number | string | null | undefined;
  detalle?: Record<string, unknown> | null;
  calculadaAt?: string | null;
}) {
  const numeric = pct === null || pct === undefined || pct === '' ? null : Number(pct);

  if (numeric === null || Number.isNaN(numeric)) {
    return (
      <span
        title={buildTooltip(null, detalle, calculadaAt)}
        style={{
          background: '#e5e7eb',
          color: '#6b7280',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        —
      </span>
    );
  }

  const [bg, fg] = pickColor(numeric);
  return (
    <span
      title={buildTooltip(numeric, detalle, calculadaAt)}
      style={{
        background: bg,
        color: fg,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'help',
        whiteSpace: 'nowrap',
      }}
    >
      {numeric.toFixed(2)}%
    </span>
  );
}

function pickColor(pct: number): [string, string] {
  if (pct > 100) return ['#dbeafe', '#1e40af'];   // azul
  if (pct >= 90) return ['#dcfce7', '#166534'];   // verde
  if (pct >= 75) return ['#ecfccb', '#3f6212'];   // lima
  if (pct >= 50) return ['#fef3c7', '#92400e'];   // amarillo
  if (pct >= 25) return ['#ffedd5', '#9a3412'];   // naranja
  return ['#fee2e2', '#991b1b'];                   // rojo
}

function buildTooltip(
  pct: number | null,
  detalle?: Record<string, unknown> | null,
  calculadaAt?: string | null,
): string {
  const lines: string[] = [];
  if (pct === null) lines.push('Eficiencia no calculada');
  else lines.push(`Eficiencia: ${pct.toFixed(2)}%`);

  if (detalle) {
    if (typeof detalle.formula === 'string') lines.push(`Fórmula: ${detalle.formula}`);
    if (typeof detalle.motivo === 'string') lines.push(`Motivo: ${detalle.motivo}`);
    const numericKeys = ['numerador_costo_fijo', 'denominador_valor_orig', 'ops_total', 'ops_contables', 'ops_fraccion_alta', 'ops_productividad'];
    for (const k of numericKeys) {
      const v = detalle[k];
      if (typeof v === 'number') lines.push(`${k}: ${v.toLocaleString('es-AR')}`);
    }
    if (typeof detalle.version === 'string') lines.push(`(${detalle.version})`);
  }

  if (calculadaAt) {
    try {
      lines.push(`Calc: ${new Date(calculadaAt).toLocaleString('es-AR')}`);
    } catch {
      // noop
    }
  }

  return lines.join('\n');
}

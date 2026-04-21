import React from 'react';

/**
 * SPEC INTEGRAL Fase B — BadgeEficiencia reutilizable.
 *
 * Badge visual con color según escala (alineada con LiqEficienciaService::calificar/colorBadge):
 *   ≥ 95% Excelente   verde oscuro  #2E7D32
 *   ≥ 85% Muy Bueno   verde claro   #388E3C
 *   ≥ 70% Bueno       amarillo      #F9A825
 *   ≥ 50% Regular     naranja       #F57C00
 *   < 50% Bajo        rojo          #C62828
 *   null  Sin datos   gris          #9E9E9E
 *
 * Variantes:
 *   size='sm' — para tablas (22x14mm aprox)
 *   size='md' — para el PDF distribuidor y el panel Gestionar
 *   size='lg' — para resumen en cards
 */

type Size = 'sm' | 'md' | 'lg';

export function calificar(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'Sin datos';
  if (pct >= 95) return 'Excelente';
  if (pct >= 85) return 'Muy Bueno';
  if (pct >= 70) return 'Bueno';
  if (pct >= 50) return 'Regular';
  return 'Bajo';
}

export function colorEficiencia(pct: number | null | undefined): { bg: string; fg: string } {
  if (pct === null || pct === undefined) return { bg: '#9E9E9E', fg: '#fff' };
  if (pct >= 95) return { bg: '#2E7D32', fg: '#fff' };
  if (pct >= 85) return { bg: '#388E3C', fg: '#fff' };
  if (pct >= 70) return { bg: '#F9A825', fg: '#000' };
  if (pct >= 50) return { bg: '#F57C00', fg: '#fff' };
  return { bg: '#C62828', fg: '#fff' };
}

export function BadgeEficiencia({
  pct,
  size = 'sm',
  subtitle,
  title,
}: {
  pct: number | string | null | undefined;
  size?: Size;
  /** texto pequeño abajo del %, ej "488/542 paradas Z4" */
  subtitle?: string | null;
  /** tooltip custom */
  title?: string;
}) {
  const num = pct === null || pct === undefined || pct === '' ? null : Number(pct);
  const valid = num !== null && !Number.isNaN(num);
  const { bg, fg } = colorEficiencia(valid ? num : null);
  const cal = calificar(valid ? num : null);

  const sizes: Record<Size, { pad: string; font: string; sub: string; label: string }> = {
    sm: { pad: '2px 8px',  font: '12px',   sub: '9px',  label: '8px'  },
    md: { pad: '6px 12px', font: '16px',   sub: '10px', label: '9px'  },
    lg: { pad: '10px 16px', font: '22px', sub: '11px', label: '10px' },
  };
  const s = sizes[size];

  const tip = title ?? (valid
    ? `Eficiencia ${num!.toFixed(2)}% — ${cal}${subtitle ? `\n${subtitle}` : ''}`
    : 'Eficiencia sin datos — falta cargar YCC');

  return (
    <span
      title={tip}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        color: fg,
        padding: s.pad,
        borderRadius: 6,
        fontWeight: 700,
        lineHeight: 1.1,
        textAlign: 'center',
        minWidth: size === 'lg' ? 90 : (size === 'md' ? 72 : 50),
        cursor: 'help',
      }}
    >
      {size === 'lg' && (
        <span style={{ fontSize: s.label, opacity: 0.85, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Eficiencia
        </span>
      )}
      <span style={{ fontSize: s.font }}>
        {valid ? `${num!.toFixed(size === 'sm' ? 0 : 1)}%` : '—'}
      </span>
      {(size !== 'sm') && (
        <span style={{ fontSize: s.sub, opacity: 0.9 }}>{cal}</span>
      )}
      {subtitle && size !== 'sm' && (
        <span style={{ fontSize: s.sub, opacity: 0.75 }}>{subtitle}</span>
      )}
    </span>
  );
}

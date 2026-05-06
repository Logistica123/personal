import React from 'react';
import type { EstadoPersonaSnapshot, AlertaEstado } from './types';

/**
 * BUGFIX 02 Issue 3 — badge del estado actual del distribuidor.
 *
 * Si el asegurado está "activo" en la póliza pero el distribuidor está en
 * baja/suspendido/etc., se muestra `⚠` con tooltip. Si no hay match con
 * persona, retorna `—`.
 */
type Props = {
  estado: EstadoPersonaSnapshot | null | undefined;
  alerta?: AlertaEstado | null;
};

const LABELS: Record<EstadoPersonaSnapshot, { texto: string; clase: string }> = {
  activo:              { texto: 'Activo',     clase: 'is-activo' },
  solicitud_pendiente: { texto: 'Solicitud',  clase: 'is-solicitud' },
  suspendido:          { texto: 'Suspendido', clase: 'is-suspendido' },
  baja:                { texto: 'Baja',       clase: 'is-baja' },
  sin_aprobar:         { texto: 'Sin aprobar', clase: 'is-sin-aprobar' },
};

const ALERTA_TOOLTIP: Record<AlertaEstado, string> = {
  persona_baja_en_poliza_activa:               'El distribuidor está en baja pero la póliza lo cubre activamente.',
  persona_suspendida_en_poliza_activa:         'El distribuidor está suspendido pero la póliza lo cubre activamente.',
  persona_solicitud_pendiente_en_poliza_activa:'El distribuidor está en solicitud pendiente pero la póliza lo cubre activamente.',
  persona_sin_aprobar_en_poliza_activa:        'El distribuidor no fue aprobado pero la póliza lo cubre activamente.',
};

export const EstadoDistribuidorBadge: React.FC<Props> = ({ estado, alerta }) => {
  if (!estado) {
    return <span className="estado-dist-badge is-vacio">—</span>;
  }
  const { texto, clase } = LABELS[estado];
  return (
    <span className={`estado-dist-badge ${clase}`} title={alerta ? ALERTA_TOOLTIP[alerta] : undefined}>
      {texto}
      {alerta && <span className="estado-dist-badge__alerta" aria-label="Inconsistencia"> ⚠</span>}
    </span>
  );
};

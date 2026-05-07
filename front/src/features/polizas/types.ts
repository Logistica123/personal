// Tipos del módulo Pólizas — alineados con los modelos Eloquent del backend.

export type ParserPerfil = 'mapfre' | 'san_cristobal' | 'la_segunda';
export type Ramo = 'accidentes_personales' | 'vehiculos';
export type TipoAsegurado = 'persona' | 'vehiculo';
export type EstadoAsegurado =
  | 'activo'
  | 'alta_solicitada'
  | 'baja_solicitada'
  | 'dado_de_baja'
  | 'no_matcheado';
export type TipoEndoso = 'constancia' | 'incorporacion' | 'baja' | 'modificacion';
export type TipoEmail = 'alta' | 'baja';

export type Aseguradora = {
  id: number;
  nombre: string;
  parser_perfil: ParserPerfil;
};

export type Poliza = {
  id: number;
  aseguradora_id: number;
  aseguradora?: Aseguradora;
  nombre_descriptivo: string;
  ramo: Ramo;
  subramo: string | null;
  tipo_asegurado: TipoAsegurado;
  numero_poliza: string;
  numero_cuenta_cliente: string | null;
  vigencia_desde: string;
  vigencia_hasta: string;
  tomador_cuit: string | null;
  tomador_razon_social: string | null;
  tomador_domicilio: string | null;
  suma_asegurada_total: string | null;
  premio_anual: string | null;
  cantidad_vidas_unidades: number;
  clausulas_especiales: string | null;
  alerta_dias_antes_vencimiento: number;
  activa: boolean;
  notas: string | null;
  asegurados_activos_count?: number;
  asegurados_count?: number;
  email_configs?: PolizaEmailConfig[];
  endosos?: PolizaEndoso[];
};

export type PolizaEmailConfig = {
  id: number;
  poliza_id: number;
  tipo: TipoEmail;
  destinatarios_to: string[];
  destinatarios_cc: string[] | null;
  destinatarios_bcc: string[] | null;
  contacto_nombre: string | null;
  asunto_template: string;
  body_template: string;
  asegurado_template: string;
  adjuntos_requeridos: string[] | null;
  activo: boolean;
};

export type PolizaEndoso = {
  id: number;
  poliza_id: number;
  numero_endoso: string;
  tipo: TipoEndoso;
  fecha_emision: string;
  archivo_id: number | null;
  descripcion: string | null;
  premio_endoso: string | null;
  created_at: string;
};

export type PolizaAseguradoPersona = {
  id: number;
  apellidos: string | null;
  nombres: string | null;
  cuil: string | null;
  patente: string | null;
  estado_id: number | null;
};

/**
 * BUGFIX 02 Issue 3 — datos enriquecidos del distribuidor para badges de
 * estado en listados (asegurados, preview, selectores). Devuelto por
 * `serializarDistribuidor` en el backend.
 */
export type DistribuidorEnriquecido = {
  id: number;
  nombre_completo: string;
  cuil: string | null;
  patente: string | null;
  estado_actual: EstadoPersonaSnapshot;
  es_solicitud: boolean;
  aprobado: boolean;
  fecha_baja: string | null;
  perfil?: string | null;
};

export type PolizaAsegurado = {
  id: number;
  poliza_id: number;
  persona_id: number | null;
  tipo_asegurado: TipoAsegurado;
  identificador: string;
  identificador_tipo: 'dni' | 'cuil' | 'patente';
  numero_orden_aseguradora: string | null;
  nombre_apellido_pdf: string | null;
  marca_modelo_pdf: string | null;
  tipo_vehiculo_pdf: string | null;
  localidad_pdf: string | null;
  suma_asegurada: string | null;
  premio_individual: string | null;
  fecha_alta_efectiva: string | null;
  fecha_baja_efectiva: string | null;
  estado: EstadoAsegurado;
  match_score: string | null;
  match_metodo: 'cuil_exacto' | 'dni_exacto' | 'patente_exacto' | 'manual' | null;
  persona_estado_al_matchear: EstadoPersonaSnapshot | null;
  persona_alerta_estado: AlertaEstado | null;
  // BUGFIX 02 Issue 1 — sugerencia fuzzy NO autovincula
  sugerencia_fuzzy_persona_id: number | null;
  sugerencia_fuzzy_score: string | null;
  sugerencia_fuzzy_persona?: { id: number; nombre: string; cuil: string | null; score: string | null } | null;
  revision_manual_pendiente: boolean;
  notas: string | null;
  // `persona` es ahora la versión enriquecida (con `estado_actual`)
  persona?: DistribuidorEnriquecido | null;
};

export type DiscrepanciaSinPersona = {
  id: number;
  identificador: string;
  identificador_tipo: string;
  nombre_apellido_pdf: string | null;
  marca_modelo_pdf: string | null;
  tipo_vehiculo_pdf: string | null;
  estado: EstadoAsegurado;
  numero_orden_aseguradora: string | null;
  riesgo: 'fantasma';
};

export type DiscrepanciaSinPoliza = {
  persona_id: number;
  nombre: string;
  cuil: string | null;
  patente: string | null;
  perfil: string | null;
  riesgo: 'sin_cobertura';
};

export type DiscrepanciaDudoso = {
  id: number;
  identificador: string;
  identificador_tipo: string;
  nombre_apellido_pdf: string | null;
  sugerencia_fuzzy_persona_id: number | null;
  sugerencia_fuzzy_score: string | null;
  motivo: 'sugerencia_fuzzy_pendiente_revision';
  persona_sugerida: { id: number; nombre: string; cuil: string | null } | null;
};

export type EstadoPersonaSnapshot =
  | 'activo' | 'baja' | 'suspendido' | 'solicitud_pendiente' | 'sin_aprobar';

export type AlertaEstado =
  | 'persona_baja_en_poliza_activa'
  | 'persona_suspendida_en_poliza_activa'
  | 'persona_solicitud_pendiente_en_poliza_activa'
  | 'persona_sin_aprobar_en_poliza_activa';

export type MatchPropuesto = {
  persona_id: number;
  score: number;
  metodo: 'cuil_exacto' | 'dni_exacto' | 'patente_exacto' | 'manual';
  revision_manual_pendiente: boolean;
  persona_estado_al_matchear?: EstadoPersonaSnapshot;
  // BUGFIX: nombre + estado para que la UI del preview pueda mostrar quién es
  // realmente el distribuidor matcheado.
  persona?: DistribuidorEnriquecido | null;
};

/**
 * BUGFIX 02 Issue 1 — sugerencia fuzzy por nombre devuelta por
 * `CargaPolizaService::armarPreview`. NO autovincula; el admin decide.
 */
export type SugerenciaFuzzy = {
  persona_id: number;
  score: number;
  persona?: DistribuidorEnriquecido | null;
};

export type DiscrepanciaEstadoInconsistente = {
  asegurado_id: number;
  identificador: string;
  identificador_tipo: string;
  nombre_apellido_pdf: string | null;
  marca_modelo_pdf: string | null;
  persona_id: number;
  persona_nombre: string;
  persona_cuil: string | null;
  persona_estado_al_matchear: EstadoPersonaSnapshot;
  persona_fecha_baja: string | null;
};

export type PreviewAsegurado = {
  tipo: TipoAsegurado;
  identificador: string;
  identificador_tipo: 'dni' | 'cuil' | 'patente';
  numero_orden_aseguradora?: string | null;
  nombre_apellido?: string | null;
  fecha_nacimiento?: string | null;
  marca_modelo?: string | null;
  tipo_vehiculo?: string | null;
  localidad?: string | null;
  suma_asegurada?: number | null;
  premio_individual?: number | null;
  match_propuesto: MatchPropuesto | null;
  sugerencia_fuzzy?: SugerenciaFuzzy | null;
  decision_default: 'vincular' | 'crear' | 'revisar';
};

export type CargaPreview = {
  aseguradora_detectada: ParserPerfil | null;
  tipo_documento: string | null;
  poliza_pdf: Record<string, unknown>;
  endoso: {
    numero_endoso?: string;
    tipo?: TipoEndoso;
    fecha_emision?: string;
    descripcion?: string | null;
    premio_endoso?: number | null;
  } | null;
  asegurados: PreviewAsegurado[];
  warnings: string[];
};

export type TipoClausula = 'no_repeticion' | 'subrogacion' | 'otra';
export type TipoClausulaGlobal = 'ninguna' | 'aplicar' | 'previa_existente';
export type TipoAplicacion = 'global' | 'individual';

export type Clausula = {
  id: number;
  nombre_corto: string;
  alias: string;
  cliente_id: number | null;
  sucursal_id: number | null;
  cuit_titular: string;
  razon_social_titular: string;
  tipo: TipoClausula;
  descripcion_corta: string | null;
  activa: boolean;
  notas: string | null;
};

export type ClausulaAplicada = {
  id: number;
  poliza_id: number;
  clausula_id: number;
  tipo_aplicacion: TipoAplicacion;
  aplicada_desde: string;
  aplicada_hasta: string | null;
  notas: string | null;
  clausula?: Clausula;
};

export type EstadoSolicitud =
  | 'borrador'
  | 'enviado'
  | 'respondida_ok'
  | 'respondida_rechazada'
  | 'cancelada';

export type PolizaSolicitud = {
  id: number;
  poliza_id: number;
  tipo: TipoEmail;
  administrativo_user_id: number;
  fecha_solicitud: string;
  destinatarios_to_resueltos: string[];
  destinatarios_cc_resueltos: string[];
  asunto: string;
  body: string;
  estado: EstadoSolicitud;
  enviado_en: string | null;
  respuesta_recibida_en: string | null;
  respuesta_resumen: string | null;
  email_message_id: string | null;
  tipo_clausula_global?: TipoClausulaGlobal;
  clausula_global_id?: number | null;
  clausulas_individuales?: Array<{ asegurado_id: number; clausula_id: number }> | null;
  asegurados_count?: number;
  poliza?: { id: number; nombre_descriptivo: string; numero_poliza: string; aseguradora?: { id: number; nombre: string } };
  administrativo?: { id: number; name: string | null; email: string | null };
};

export type SolicitudPreview = {
  solicitud_id: number;
  tipo: TipoEmail;
  asegurados_count: number;
  asunto: string;
  body: string;
  destinatarios_to: string[];
  destinatarios_cc: string[];
  destinatarios_bcc: string[];
  adjuntos_requeridos: string[];
  adjuntos_check: {
    ok: boolean;
    faltantes: Array<{ asegurado_id: number; identificador: string; faltan: string[]; motivo?: string }>;
  };
};

export type EstadoNotificacionDistribuidor = 'pendiente' | 'enviado' | 'rebotado' | 'sin_email';

export type NotificacionDistribuidor = {
  id: number;
  asegurado_id: number;
  poliza_id: number;
  persona_id: number;
  tipo: 'alta' | 'baja';
  email_destinatario: string;
  asunto: string;
  body: string;
  estado: EstadoNotificacionDistribuidor;
  enviado_en: string | null;
  error_envio: string | null;
  poliza?: { id: number; numero_poliza: string; aseguradora?: { nombre: string } };
  persona?: { id: number; apellidos: string | null; nombres: string | null; email: string | null };
};

export type Discrepancias = {
  poliza_id: number;
  tipo_asegurado: TipoAsegurado;
  asegurados_sin_persona: DiscrepanciaSinPersona[];
  personas_sin_poliza: DiscrepanciaSinPoliza[];
  match_dudoso: DiscrepanciaDudoso[];
  estado_inconsistente: {
    persona_baja_en_poliza_activa: DiscrepanciaEstadoInconsistente[];
    persona_suspendida_en_poliza_activa: DiscrepanciaEstadoInconsistente[];
    persona_solicitud_pendiente_en_poliza_activa: DiscrepanciaEstadoInconsistente[];
    persona_sin_aprobar_en_poliza_activa: DiscrepanciaEstadoInconsistente[];
  };
};

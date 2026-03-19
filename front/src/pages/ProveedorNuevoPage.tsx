import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type PersonalDocumentType = {
  id: number;
  nombre: string | null;
  vence: boolean;
};

type PersonalMeta = {
  perfiles: Array<{ value: number; label: string }>;
  clientes: Array<{ id: number; nombre: string | null }>;
  sucursales: Array<{ id: number; cliente_id: number | null; nombre: string | null }>;
  agentes: Array<{ id: number; name: string | null }>;
  unidades: Array<{ id: number; matricula: string | null; marca: string | null; modelo: string | null }>;
  estados: Array<{ id: number; nombre: string | null }>;
  documentTypes?: PersonalDocumentType[];
};

type ProveedorNuevoPageProps = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  isPersonalEditor: (authUser: AuthUser | null | undefined) => boolean;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
  PERSON_TAX_ID_LABEL: string;
  COLLECTOR_TAX_ID_LABEL: string;
  OWNER_TAX_ID_LABEL: string;
  OWNER_COLLECTOR_TAX_ID_LABEL: string;
  PAGO_SELECT_OPTIONS: Array<{ value: string; label: string }>;
};

const serializePagoValue = (value: string | number | boolean | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase() === 'true') {
    return 1;
  }
  if (normalized.toLowerCase() === 'false') {
    return 0;
  }

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return numeric;
};

const PERFIL_DISPLAY_LABELS: Record<number, string> = {
  1: 'Transportista',
  2: 'Cobrador',
  3: 'Servicios',
};

const getPerfilDisplayLabel = (value?: number | null, fallback?: string | null): string => {
  if (value != null && PERFIL_DISPLAY_LABELS[value]) {
    return PERFIL_DISPLAY_LABELS[value];
  }
  return fallback ?? '';
};

export const ProveedorNuevoPage: React.FC<ProveedorNuevoPageProps> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  isPersonalEditor,
  buildActorHeaders,
  PERSON_TAX_ID_LABEL,
  COLLECTOR_TAX_ID_LABEL,
  OWNER_TAX_ID_LABEL,
  OWNER_COLLECTOR_TAX_ID_LABEL,
  PAGO_SELECT_OPTIONS,
}) => {
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const syntheticPreActivoEstadoId = '-1';
  const canManagePersonal = useMemo(() => isPersonalEditor(authUser), [authUser]);
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser]);
  const [meta, setMeta] = useState<PersonalMeta | null>(null);
  const allowedPerfiles = useMemo(() => {
    const perfiles = meta?.perfiles ?? [];
    const filtered = perfiles.filter((perfil) => perfil.value !== 2);
    return filtered.length > 0 ? filtered : perfiles;
  }, [meta?.perfiles]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nosisLookupLoading, setNosisLookupLoading] = useState(false);
  const [nosisLookupError, setNosisLookupError] = useState<string | null>(null);
  const [nosisLookupInfo, setNosisLookupInfo] = useState<string | null>(null);
  const nosisLastLookupRef = useRef<string | null>(null);
  const normalizeEstadoNombre = useCallback((value: string | null | undefined): string => {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);
  const splitRazonSocial = useCallback((razonSocial: string | null | undefined) => {
    if (!razonSocial) {
      return null;
    }
    const raw = razonSocial.trim();
    if (!raw) {
      return null;
    }
    const parts = raw.split(',');
    if (parts.length >= 2) {
      return { apellidos: parts[0].trim(), nombres: parts.slice(1).join(' ').trim() };
    }
    const tokens = raw.split(/\s+/);
    if (tokens.length >= 2) {
      return { apellidos: tokens[0], nombres: tokens.slice(1).join(' ').trim() };
    }
    return { apellidos: '', nombres: raw };
  }, []);
  const parseNosisXml = useCallback((payload: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(payload, 'application/xml');

      const getText = (selector: string) => doc.getElementsByTagName(selector)?.[0]?.textContent?.trim() ?? '';
      const contenido = doc.getElementsByTagName('Contenido')?.[0] ?? null;
      const resultado = contenido?.getElementsByTagName('Resultado')?.[0] ?? null;
      const datos = contenido?.getElementsByTagName('Datos')?.[0] ?? null;
      const persona = datos?.getElementsByTagName('Persona')?.[0] ?? null;

      const razonSocial = persona ? (persona.getElementsByTagName('RazonSocial')[0]?.textContent?.trim() ?? '') : '';
      const documento = persona ? (persona.getElementsByTagName('Documento')[0]?.textContent?.trim() ?? '') : '';
      const fechaNacimiento = persona ? (persona.getElementsByTagName('FechaNacimiento')[0]?.textContent?.trim() ?? '') : '';
      const resultadoNovedad = resultado ? (resultado.getElementsByTagName('Novedad')[0]?.textContent?.trim() ?? '') : '';
      const message = resultadoNovedad || getText('Novedad') || payload;

      return {
        message,
        razonSocial,
        documento,
        fechaNacimiento,
      };
    } catch {
      return null;
    }
  }, []);
  const normalizeNosisDate = useCallback((value: string | null | undefined): string => {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month}-${day}`;
    }
    return '';
  }, []);

  const [formValues, setFormValues] = useState({
    perfilValue: 1,
    nombres: '',
    apellidos: '',
    legajo: '',
    telefono: '',
    email: '',
    cuil: '',
    pago: '',
    cbuAlias: '',
    patente: '',
    clienteId: '',
    sucursalId: '',
    agenteId: '',
    unidadId: '',
    estadoId: '',
    fechaAlta: '',
    fechaBaja: '',
    observacionTarifa: '',
    observaciones: '',
    combustible: false,
    combustibleEstado: '',
    tarifaEspecial: false,
    esCobrador: true,
    cobradorNombre: '',
    cobradorEmail: '',
    cobradorCuil: '',
    cobradorCbuAlias: '',
    duenoNombre: '',
    duenoFechaNacimiento: '',
    duenoEmail: '',
    duenoCuil: '',
    duenoCuilCobrador: '',
    duenoCbuAlias: '',
    duenoTelefono: '',
    duenoObservaciones: '',
  });

  useEffect(() => {
    if (!canManagePersonal) {
      setLoading(false);
      return;
    }

    const fetchMeta = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch(`${apiBaseUrl}/api/personal-meta`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as PersonalMeta;
        setMeta(payload);
        const firstAvailable = payload.perfiles.find((perfil) => perfil.value !== 2) ?? payload.perfiles[0];
        if (firstAvailable) {
          setFormValues((prev) => ({
            ...prev,
            perfilValue: firstAvailable.value,
          }));
        }
      } catch (err) {
        setLoadError((err as Error).message ?? 'No se pudo cargar la información.');
      } finally {
        setLoading(false);
      }
    };

    fetchMeta();
  }, [apiBaseUrl, canManagePersonal, normalizeEstadoNombre]);

  const estadoOptions = useMemo(() => {
    if (!meta?.estados) {
      return [] as PersonalMeta['estados'];
    }

    const options = [...meta.estados];
    const hasPreActivo = options.some((estado) => {
      const normalized = normalizeEstadoNombre(estado.nombre);
      return normalized === 'pre activo' || normalized === 'preactivo';
    });

    if (!hasPreActivo) {
      options.push({
        id: Number(syntheticPreActivoEstadoId),
        nombre: 'Pre activo',
      });
    }

    options.sort((a, b) => {
      const aNormalized = normalizeEstadoNombre(a.nombre);
      const bNormalized = normalizeEstadoNombre(b.nombre);
      const aIsPreActivo = aNormalized === 'pre activo' || aNormalized === 'preactivo';
      const bIsPreActivo = bNormalized === 'pre activo' || bNormalized === 'preactivo';

      if (aIsPreActivo && !bIsPreActivo) {
        return -1;
      }
      if (!aIsPreActivo && bIsPreActivo) {
        return 1;
      }

      const aLabel = (a.nombre ?? '').toLowerCase();
      const bLabel = (b.nombre ?? '').toLowerCase();
      return aLabel.localeCompare(bLabel, 'es-AR');
    });

    return options;
  }, [meta?.estados, normalizeEstadoNombre, syntheticPreActivoEstadoId]);

  const sucursalOptions = useMemo(() => {
    if (!meta) {
      return [] as PersonalMeta['sucursales'];
    }

    if (!formValues.clienteId) {
      return meta.sucursales;
    }

    const clienteId = Number(formValues.clienteId);
    return meta.sucursales.filter((sucursal) => sucursal.cliente_id === clienteId);
  }, [meta, formValues.clienteId]);

  const handleCheckboxChange = (field: 'combustible' | 'tarifaEspecial') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [field]: checked,
      ...(field === 'combustible' && !checked ? { combustibleEstado: '' } : {}),
    }));
  };

  const handleCobradorToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormValues((prev) => ({
      ...prev,
      esCobrador: checked,
      ...(checked
        ? {}
        : { cobradorNombre: '', cobradorEmail: '', cobradorCuil: '', cobradorCbuAlias: '' }),
    }));
  };

  const lookupNosisByDocumento = useCallback(
    async (showValidationError = true) => {
      if (nosisLookupLoading) {
        return;
      }

      const documento = formValues.cuil.replace(/\D+/g, '');
      if (!documento) {
        if (showValidationError) {
          setNosisLookupError(`Ingresá un ${PERSON_TAX_ID_LABEL} para consultar en Nosis.`);
        }
        return;
      }
      if (documento.length !== 11) {
        if (showValidationError) {
          setNosisLookupError(`Ingresá un ${PERSON_TAX_ID_LABEL} válido de 11 dígitos.`);
        }
        return;
      }

      if (!showValidationError && nosisLastLookupRef.current === documento) {
        return;
      }

      const url = new URL(`${apiBaseUrl}/api/nosis/consultar-documento`);
      url.searchParams.set('documento', documento);

      try {
        setNosisLookupLoading(true);
        setNosisLookupError(null);
        setNosisLookupInfo(null);

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            ...actorHeaders,
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json();
        const raw = payload?.data?.raw;
        const parsed = payload?.data?.parsed ?? (typeof raw === 'string' ? parseNosisXml(raw) : null);
        const razonSocial = parsed?.razonSocial ?? '';
        const razonSplit = splitRazonSocial(razonSocial);
        const fullName = razonSocial.trim();
        const nombresFromNosis = razonSplit?.nombres ?? '';
        const apellidosFromNosis = razonSplit?.apellidos ?? '';
        const documentoFromNosis = (parsed?.documento ?? '').replace(/\D+/g, '');
        const fechaNacimientoFromNosis = normalizeNosisDate(parsed?.fechaNacimiento ?? '');

        setFormValues((prev) => {
          const next = { ...prev };
          const profileIsCobrador = prev.perfilValue === 2;
          if (!prev.nombres.trim()) {
            if (profileIsCobrador) {
              const fullNameFallback = fullName || [nombresFromNosis, apellidosFromNosis].filter(Boolean).join(' ').trim();
              if (fullNameFallback) {
                next.nombres = fullNameFallback;
              }
            } else if (nombresFromNosis) {
              next.nombres = nombresFromNosis;
            }
          }
          if (!profileIsCobrador && !prev.apellidos.trim() && apellidosFromNosis) {
            next.apellidos = apellidosFromNosis;
          }
          if (!prev.cuil.trim() && documentoFromNosis) {
            next.cuil = documentoFromNosis;
          }
          if (!prev.duenoFechaNacimiento && fechaNacimientoFromNosis) {
            next.duenoFechaNacimiento = fechaNacimientoFromNosis;
          }
          return next;
        });

        nosisLastLookupRef.current = documento;
        const nosisMessage = parsed?.message || payload?.message || 'Datos consultados en Nosis.';
        setNosisLookupInfo(nosisMessage);
      } catch (err) {
        setNosisLookupError((err as Error).message ?? 'No se pudo consultar Nosis.');
      } finally {
        setNosisLookupLoading(false);
      }
    },
    [
      actorHeaders,
      apiBaseUrl,
      formValues.cuil,
      normalizeNosisDate,
      nosisLookupLoading,
      parseNosisXml,
      splitRazonSocial,
    ]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManagePersonal) {
      setSaveError('Solo los usuarios autorizados pueden cargar personal.');
      return;
    }

    try {
      setSaveError(null);
      setSaving(true);

      const cobradorNombre = formValues.cobradorNombre.trim() || null;
      const cobradorEmail = formValues.cobradorEmail.trim() || null;
      const cobradorCuil = formValues.cobradorCuil.trim() || null;
      const cobradorCbuAlias = formValues.cobradorCbuAlias.trim() || null;
      const hasCobradorFields = Boolean(cobradorNombre || cobradorEmail || cobradorCuil || cobradorCbuAlias);
      const esCobradorFlag = formValues.esCobrador || hasCobradorFields || formValues.perfilValue === 2;
      const combustibleEstado = formValues.combustible ? formValues.combustibleEstado || null : null;
      const duenoNombre = esCobradorFlag ? cobradorNombre : formValues.duenoNombre.trim() || null;
      const duenoEmail = esCobradorFlag ? cobradorEmail : formValues.duenoEmail.trim() || null;
      const duenoCuilCobrador = esCobradorFlag ? cobradorCuil : formValues.duenoCuilCobrador.trim() || null;
      const duenoCbuAlias = esCobradorFlag ? cobradorCbuAlias : formValues.duenoCbuAlias.trim() || null;

      const response = await fetch(`${apiBaseUrl}/api/personal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...actorHeaders,
        },
        body: JSON.stringify({
          perfilValue: formValues.perfilValue,
          nombres: formValues.nombres.trim(),
          apellidos: formValues.apellidos.trim(),
          legajo: formValues.legajo.trim() || null,
          telefono: formValues.telefono.trim() || null,
          email: formValues.email.trim() || null,
          cuil: formValues.cuil.trim() || null,
          pago: serializePagoValue(formValues.pago),
          cbuAlias: formValues.cbuAlias.trim() || null,
          patente: formValues.patente.trim() || null,
          clienteId: formValues.clienteId ? Number(formValues.clienteId) : null,
          sucursalId: formValues.sucursalId ? Number(formValues.sucursalId) : null,
          agenteId: formValues.agenteId ? Number(formValues.agenteId) : null,
          unidadId: formValues.unidadId ? Number(formValues.unidadId) : null,
          estadoId:
            formValues.estadoId && formValues.estadoId !== syntheticPreActivoEstadoId
              ? Number(formValues.estadoId)
              : null,
          fechaAlta: formValues.fechaAlta || null,
          fechaBaja: formValues.fechaBaja || null,
          observacionTarifa: formValues.observacionTarifa.trim() || null,
          observaciones: formValues.observaciones.trim() || null,
          combustible: formValues.combustible,
          combustibleEstado,
          tarifaEspecial: formValues.tarifaEspecial,
          esCobrador: esCobradorFlag,
          cobradorNombre,
          cobradorEmail,
          cobradorCuil,
          cobradorCbuAlias,
          duenoNombre,
          duenoFechaNacimiento: formValues.duenoFechaNacimiento || null,
          duenoEmail,
          duenoCuil: formValues.duenoCuil.trim() || null,
          duenoCuilCobrador,
          duenoCbuAlias,
          duenoTelefono: formValues.duenoTelefono.trim() || null,
          duenoObservaciones: formValues.duenoObservaciones.trim() || null,
          autoApprove: true,
          autoApproveUserId: authUser?.id ?? null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          } else if (payload?.errors) {
            const firstError = Object.values(payload.errors)[0];
            if (Array.isArray(firstError) && firstError[0]) {
              message = firstError[0] as string;
            }
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      const payload = (await response.json()) as { data: { id: number } };
      navigate(`/personal/${payload.data.id}/editar`);
    } catch (err) {
      setSaveError((err as Error).message ?? 'No se pudo registrar el personal.');
    } finally {
      setSaving(false);
    }
  };

  const handlePerfilChange = (value: number) => {
    setFormValues((prev) => ({ ...prev, perfilValue: value }));
  };

  const handleSelectChange = (field: keyof typeof formValues) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    let value: string | boolean = event.target.value;

    setFormValues((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'clienteId' ? { sucursalId: '' } : {}),
    }));
  };

  const renderPerfilSection = () => {
    switch (formValues.perfilValue) {
      case 1:
        return (
          <section className="personal-section">
            <h3>Transportista</h3>
            <div className="form-grid">
              {renderInput('Nombres', 'nombres', true)}
              {renderInput('Apellidos', 'apellidos', true)}
              {renderInput('Legajo', 'legajo')}
              {renderInput('Teléfono', 'telefono')}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderCuilInput()}
              {renderInput('CBU/Alias', 'cbuAlias')}
              {renderPagoSelect()}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {formValues.combustible ? (
                <label className="input-control">
                  <span>Estado combustible</span>
                  <select
                    value={formValues.combustibleEstado}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, combustibleEstado: event.target.value }))
                    }
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option>
                  </select>
                </label>
              ) : null}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
            </div>

            <div className="personal-subsection" style={{ marginTop: '1rem' }}>
              <h4>Datos de cobrador</h4>
              <div className="form-grid">
                <label className="input-control">
                  <span>¿Es cobrador?</span>
                  <div className="checkbox-control">
                    <input type="checkbox" checked={formValues.esCobrador} onChange={handleCobradorToggle} />
                    Marcar si los datos pertenecen a un cobrador
                  </div>
                </label>
                {renderInput('Nombre completo del cobrador', 'cobradorNombre', formValues.esCobrador)}
                {renderInput('Correo del cobrador', 'cobradorEmail', false, 'email')}
                {renderInput(COLLECTOR_TAX_ID_LABEL, 'cobradorCuil', formValues.esCobrador)}
                {renderInput('CBU/Alias del cobrador', 'cobradorCbuAlias', formValues.esCobrador)}
              </div>
            </div>
          </section>
        );
      case 2:
        return (
          <section className="personal-section">
            <h3>Cobrador</h3>
            <div className="form-grid">
              {renderInput('Nombre completo', 'nombres', true)}
              {renderInput('Legajo', 'legajo')}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderInput('Teléfono', 'telefono')}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderCuilInput()}
              {renderInput('CBU/Alias', 'cbuAlias')}
              {renderPagoSelect()}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {formValues.combustible ? (
                <label className="input-control">
                  <span>Estado combustible</span>
                  <select
                    value={formValues.combustibleEstado}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, combustibleEstado: event.target.value }))
                    }
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option>
                  </select>
                </label>
              ) : null}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
            </div>

            <h3>Dueño de la unidad</h3>
            <div className="form-grid">
              {renderInput('Nombre completo (Dueño)', 'duenoNombre')}
              {renderInput('Fecha de nacimiento', 'duenoFechaNacimiento', false, 'date')}
              {renderInput('Correo (Dueño)', 'duenoEmail', false, 'email')}
              {renderInput(OWNER_TAX_ID_LABEL, 'duenoCuil')}
              {renderInput(OWNER_COLLECTOR_TAX_ID_LABEL, 'duenoCuilCobrador')}
              {renderInput('CBU/Alias (Dueño)', 'duenoCbuAlias')}
              {renderInput('Teléfono (Dueño)', 'duenoTelefono')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observaciones</span>
                <textarea
                  rows={2}
                  value={formValues.duenoObservaciones}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, duenoObservaciones: event.target.value }))}
                />
              </label>
            </div>
          </section>
        );
      case 3:
        return (
          <section className="personal-section">
            <h3>Servicios</h3>
            <div className="form-grid">
              {renderInput('Nombres', 'nombres', true)}
              {renderInput('Apellidos', 'apellidos', true)}
              {renderInput('Legajo', 'legajo')}
              {renderCuilInput()}
              {renderInput('Correo electrónico', 'email', false, 'email')}
              {renderInput('Teléfono', 'telefono')}
              {renderCheckbox('Combustible', 'combustible', 'Cuenta corrientes combustible')}
              {formValues.combustible ? (
                <label className="input-control">
                  <span>Estado combustible</span>
                  <select
                    value={formValues.combustibleEstado}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, combustibleEstado: event.target.value }))
                    }
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option>
                  </select>
                </label>
              ) : null}
              {renderCheckbox('Tarifa especial', 'tarifaEspecial', 'Tiene tarifa especial')}
              {renderInput('Observación tarifa', 'observacionTarifa')}
              {renderInput('Fecha de alta', 'fechaAlta', false, 'date')}
              {renderInput('Patente', 'patente')}
            </div>

            <div className="placeholder-grid">
              {renderDisabledInput('Guía/Remito')}
              {renderDisabledInput('Valor del viaje', 'number')}
              {renderDisabledInput('Origen')}
              {renderDisabledInput('Destino')}
              <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                <span>Observación</span>
                <textarea disabled rows={2} />
              </label>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const renderCuilInput = () => (
    <label className="input-control">
      <span>{PERSON_TAX_ID_LABEL}</span>
      <input
        type="text"
        value={formValues.cuil}
        onChange={(event) => {
          const nextValue = event.target.value.replace(/\D+/g, '').slice(0, 11);
          setFormValues((prev) => ({ ...prev, cuil: nextValue }));
          setNosisLookupError(null);
          setNosisLookupInfo(null);
          nosisLastLookupRef.current = null;
        }}
        placeholder="Ingresar"
        inputMode="numeric"
        maxLength={11}
      />
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          void lookupNosisByDocumento(true);
        }}
        disabled={nosisLookupLoading}
        style={{ alignSelf: 'flex-start' }}
      >
        {nosisLookupLoading ? 'Consultando...' : 'Autocompletar'}
      </button>
      {nosisLookupError ? <span className="form-info form-info--error">{nosisLookupError}</span> : null}
      {!nosisLookupError && nosisLookupInfo ? <span className="form-info form-info--success">{nosisLookupInfo}</span> : null}
    </label>
  );

  const renderInput = (
    label: string,
    field: keyof typeof formValues,
    required = false,
    type: 'text' | 'email' | 'number' | 'date' = 'text'
  ) => (
    <label className="input-control">
      <span>{label}</span>
      <input
        type={type}
        value={formValues[field] as string}
        onChange={(event) => setFormValues((prev) => ({ ...prev, [field]: event.target.value }))}
        placeholder="Ingresar"
        required={required}
      />
    </label>
  );

  const renderPagoSelect = () => (
    <label className="input-control">
      <span>Pago</span>
      <select
        value={formValues.pago}
        onChange={(event) => setFormValues((prev) => ({ ...prev, pago: event.target.value }))}
      >
        <option value="">S/N factura</option>
        {PAGO_SELECT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const renderCheckbox = (label: string, field: 'combustible' | 'tarifaEspecial', text: string) => (
    <label className="input-control">
      <span>{label}</span>
      <div className="checkbox-control">
        <input type="checkbox" checked={formValues[field]} onChange={handleCheckboxChange(field)} />
        {text}
      </div>
    </label>
  );

  const renderDisabledInput = (label: string, type: 'text' | 'email' | 'date' | 'number' = 'text') => (
    <label className="input-control">
      <span>{label}</span>
      <input type={type} disabled placeholder="—" />
    </label>
  );

  if (!canManagePersonal) {
    return (
      <DashboardLayout title="Registrar proveedor" subtitle="Proveedor" headerContent={null}>
        <p className="form-info form-info--error">
          Solo los usuarios autorizados pueden cargar proveedores.
        </p>
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          ← Volver a proveedores
        </button>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Registrar proveedor" subtitle="Proveedor" headerContent={null}>
        <p className="form-info">Cargando información necesaria...</p>
      </DashboardLayout>
    );
  }

  if (loadError || !meta) {
    return (
      <DashboardLayout title="Registrar proveedor" subtitle="Proveedor" headerContent={null}>
        <p className="form-info form-info--error">{loadError ?? 'No se pudieron cargar los datos necesarios.'}</p>
        <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
          ← Volver a proveedores
        </button>
      </DashboardLayout>
    );
  }

  const headerContent = (
    <div className="card-header card-header--compact">
      <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
        ← Volver a proveedores
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Registrar proveedor" subtitle="Proveedor" headerContent={headerContent}>
      <form className="personal-edit-section" onSubmit={handleSubmit}>
        <h2>Datos del proveedor</h2>

        <div className="radio-group">
          <span>Seleccionar perfil</span>
          <div className="radio-options">
            {allowedPerfiles.map((perfil) => (
              <label key={perfil.value} className={`radio-option${formValues.perfilValue === perfil.value ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="perfil"
                  value={perfil.value}
                  checked={formValues.perfilValue === perfil.value}
                  onChange={() => handlePerfilChange(perfil.value)}
                />
                {getPerfilDisplayLabel(perfil.value, perfil.label)}
              </label>
            ))}
          </div>
        </div>

        {renderPerfilSection()}

        <h3>Datos de vinculación</h3>
        <div className="form-grid">
          <label className="input-control">
            <span>Cliente</span>
            <select value={formValues.clienteId} onChange={handleSelectChange('clienteId')}>
              <option value="">Seleccionar</option>
              {meta.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre ?? `Cliente #${cliente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Sucursal</span>
            <select value={formValues.sucursalId} onChange={handleSelectChange('sucursalId')} disabled={sucursalOptions.length === 0}>
              <option value="">Seleccionar</option>
              {sucursalOptions.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre ?? `Sucursal #${sucursal.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Agente</span>
            <select value={formValues.agenteId} onChange={handleSelectChange('agenteId')}>
              <option value="">Seleccionar</option>
              {meta.agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name ?? `Agente #${agente.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Unidad</span>
            <select value={formValues.unidadId} onChange={handleSelectChange('unidadId')}>
              <option value="">Seleccionar</option>
              {meta.unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {[unidad.matricula, unidad.marca, unidad.modelo].filter(Boolean).join(' - ') || `Unidad #${unidad.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Estado</span>
            <select value={formValues.estadoId} onChange={handleSelectChange('estadoId')}>
              <option value="">Seleccionar</option>
              {estadoOptions.map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre ?? `Estado #${estado.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="input-control">
            <span>Fecha de alta</span>
            <input
              type="date"
              value={formValues.fechaAlta}
              onChange={(event) => setFormValues((prev) => ({ ...prev, fechaAlta: event.target.value }))}
            />
          </label>
          <label className="input-control" style={{ gridColumn: '1 / -1' }}>
            <span>Observaciones</span>
            <textarea
              value={formValues.observaciones}
              onChange={(event) => setFormValues((prev) => ({ ...prev, observaciones: event.target.value }))}
              rows={3}
            />
          </label>
        </div>

        {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => navigate('/personal')}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? 'Registrando...' : 'Siguiente'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

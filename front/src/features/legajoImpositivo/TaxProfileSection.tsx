import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientTaxDocumentRecord, TaxProfileRecord } from './types';
import {
  buildTaxSnapshotSummary,
  mergeTaxProfileWithNosisParsed,
  normalizeTaxActivities,
  readTaxSnapshotParsedText,
} from './nosis';

const AUTH_STORAGE_KEY = 'authUser';
const DEFAULT_PERSON_TAX_ID_LABEL = 'CUIT/CUIL';

const resolveApiUrl = (baseUrl: string, target?: string | null): string | null => {
  if (!target) {
    return null;
  }

  try {
    return new URL(target).toString();
  } catch {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedTarget = target.startsWith('/') ? target : `/${target}`;
    return `${normalizedBase}${normalizedTarget}`;
  }
};

const readAuthTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { token?: unknown } | null;
    const token = typeof parsed?.token === 'string' ? parsed?.token.trim() : '';
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, ' ').trim();
    const isHtmlLike =
      contentType.toLowerCase().includes('text/html') ||
      /^<!doctype html/i.test(normalized) ||
      /<html[\s>]/i.test(normalized);

    if (isHtmlLike) {
      throw new Error(
        'El servidor respondió HTML en vez de JSON. Verificá que la API esté activa y que REACT_APP_API_BASE apunte al backend.'
      );
    }

    const plainPreview = normalized.replace(/<[^>]*>/g, '').trim().slice(0, 200);
    throw new Error(plainPreview || 'Respuesta no es JSON');
  }
  return response.json();
};

const createEmptyTaxProfileForm = (seed?: Partial<TaxProfileRecord>): TaxProfileRecord => ({
  cuit: seed?.cuit ?? '',
  razonSocial: seed?.razonSocial ?? '',
  arcaStatus: seed?.arcaStatus ?? '',
  dgrStatus: seed?.dgrStatus ?? '',
  fiscalAddressStreet: seed?.fiscalAddressStreet ?? '',
  fiscalAddressNumber: seed?.fiscalAddressNumber ?? '',
  fiscalAddressFloor: seed?.fiscalAddressFloor ?? '',
  fiscalAddressUnit: seed?.fiscalAddressUnit ?? '',
  fiscalAddressLocality: seed?.fiscalAddressLocality ?? '',
  fiscalAddressPostalCode: seed?.fiscalAddressPostalCode ?? '',
  fiscalAddressProvince: seed?.fiscalAddressProvince ?? '',
  activityMainCode: seed?.activityMainCode ?? '',
  activityMainDescription: seed?.activityMainDescription ?? '',
  activityMainSector: seed?.activityMainSector ?? '',
  activityMainStartDate: seed?.activityMainStartDate ?? '',
  activities: normalizeTaxActivities(seed?.activities),
  afipKeyStatus: seed?.afipKeyStatus ?? '',
  afipKeyStatusDate: seed?.afipKeyStatusDate ?? '',
  ivaRegistered: seed?.ivaRegistered ?? null,
  ivaWithholdingExclusion: seed?.ivaWithholdingExclusion ?? null,
  ivaRegisteredAt: seed?.ivaRegisteredAt ?? '',
  ivaCondition: seed?.ivaCondition ?? '',
  gananciasRegistered: seed?.gananciasRegistered ?? null,
  gananciasWithholdingExclusion: seed?.gananciasWithholdingExclusion ?? null,
  gananciasRegisteredAt: seed?.gananciasRegisteredAt ?? '',
  gananciasCondition: seed?.gananciasCondition ?? '',
  monotributoRegistered: seed?.monotributoRegistered ?? null,
  monotributoRegisteredAt: seed?.monotributoRegisteredAt ?? '',
  monotributoCategory: seed?.monotributoCategory ?? '',
  monotributoType: seed?.monotributoType ?? '',
  monotributoActivity: seed?.monotributoActivity ?? '',
  monotributoSeniorityMonths: seed?.monotributoSeniorityMonths ?? null,
  isEmployee: seed?.isEmployee ?? null,
  isEmployer: seed?.isEmployer ?? null,
  isRetired: seed?.isRetired ?? null,
  exclusionNotes: seed?.exclusionNotes ?? '',
  exemptionNotes: seed?.exemptionNotes ?? '',
  regimeNotes: seed?.regimeNotes ?? '',
  bankAccount: seed?.bankAccount ?? '',
  bankAlias: seed?.bankAlias ?? '',
  bankOwnerName: seed?.bankOwnerName ?? '',
  bankOwnerDocument: seed?.bankOwnerDocument ?? '',
  bankValidationStatus: seed?.bankValidationStatus ?? '',
  insuranceNotes: seed?.insuranceNotes ?? '',
  observations: seed?.observations ?? '',
  latestNosisSnapshot: seed?.latestNosisSnapshot ?? null,
  snapshots: seed?.snapshots ?? [],
  documents: seed?.documents ?? [],
});

export type TaxProfileSectionProps = {
  entityType: 'cliente' | 'persona';
  entityId: number | null;
  apiBaseUrl: string;
  actorHeaders?: Record<string, string>;
  readOnly?: boolean;
  title: string;
  subtitle: string;
  personTaxIdLabel?: string;
};

export const TaxProfileSection: React.FC<TaxProfileSectionProps> = ({
  entityType,
  entityId,
  apiBaseUrl,
  actorHeaders,
  readOnly = false,
  title,
  subtitle,
  personTaxIdLabel,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<TaxProfileRecord>(() => createEmptyTaxProfileForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupInfo, setLookupInfo] = useState<string | null>(null);
  const lastLookupRef = useRef<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentInfo, setDocumentInfo] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentCategory, setDocumentCategory] = useState('OTRO');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const cuitLabel = entityType === 'cliente' ? 'CUIT' : (personTaxIdLabel ?? DEFAULT_PERSON_TAX_ID_LABEL);

  const endpoint = useMemo(() => {
    if (!entityId) {
      return null;
    }

    return entityType === 'cliente'
      ? `${apiBaseUrl}/api/clientes/${entityId}/legajo-impositivo`
      : `${apiBaseUrl}/api/personal/${entityId}/legajo-impositivo`;
  }, [apiBaseUrl, entityId, entityType]);

  const applyPayload = useCallback((payload?: TaxProfileRecord | null) => {
    setFormValues(createEmptyTaxProfileForm(payload ?? undefined));
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!endpoint) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          ...(actorHeaders ?? {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as { data?: TaxProfileRecord };
      applyPayload(payload?.data ?? null);
    } catch (err) {
      setLoadError((err as Error).message ?? 'No se pudo cargar el legajo impositivo.');
    } finally {
      setLoading(false);
    }
  }, [actorHeaders, applyPayload, endpoint]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (field: keyof TaxProfileRecord) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const nextValue = event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
    setSaveError(null);
    setSaveInfo(null);
    setRefreshError(null);
    setRefreshInfo(null);
    setLookupError(null);
    setLookupInfo(null);
    setDocumentError(null);
    setDocumentInfo(null);
    if (field === 'cuit') {
      lastLookupRef.current = null;
    }
  };

  const handleNullableBooleanChange = (
    field:
      | 'ivaRegistered'
      | 'ivaWithholdingExclusion'
      | 'gananciasRegistered'
      | 'gananciasWithholdingExclusion'
      | 'monotributoRegistered'
      | 'isEmployee'
      | 'isEmployer'
      | 'isRetired'
  ) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    const nextValue = raw === '' ? null : raw === 'true';
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
    setSaveError(null);
    setSaveInfo(null);
    setRefreshError(null);
    setRefreshInfo(null);
    setLookupError(null);
    setLookupInfo(null);
    setDocumentError(null);
    setDocumentInfo(null);
  };

  const handleLookupDocumento = useCallback(
    async (showValidationError = true) => {
      if (lookupLoading) {
        return;
      }

      const documento = (formValues.cuit ?? '').replace(/\D+/g, '');
      if (!documento) {
        if (showValidationError) {
          setLookupError(`Ingresá un ${cuitLabel} para consultar en Nosis.`);
        }
        return;
      }
      if (documento.length !== 11) {
        if (showValidationError) {
          setLookupError(`Ingresá un ${cuitLabel} válido de 11 dígitos.`);
        }
        return;
      }
      if (!showValidationError && lastLookupRef.current === documento) {
        return;
      }

      const url = new URL(`${apiBaseUrl}/api/nosis/consultar-documento`);
      url.searchParams.set('documento', documento);

      try {
        setLookupLoading(true);
        setLookupError(null);
        setLookupInfo(null);

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            ...(actorHeaders ?? {}),
          },
        });

        if (!response.ok) {
          let message = `Error ${response.status}: ${response.statusText}`;
          try {
            const payload = await response.json();
            if (typeof payload?.message === 'string') {
              message = payload.message;
            }
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const payload = (await response.json()) as {
          message?: string;
          data?: { parsed?: Record<string, unknown> | null };
        };
        const parsed = payload?.data?.parsed ?? null;
        setFormValues((prev) => mergeTaxProfileWithNosisParsed(prev, parsed));
        lastLookupRef.current = documento;
        setLookupInfo(
          readTaxSnapshotParsedText(parsed, ['message', 'resultadoNovedad'])
            ?? payload?.message
            ?? 'Datos consultados en Nosis.'
        );
      } catch (err) {
        setLookupError((err as Error).message ?? 'No se pudo consultar Nosis.');
      } finally {
        setLookupLoading(false);
      }
    },
    [actorHeaders, apiBaseUrl, cuitLabel, formValues.cuit, lookupLoading]
  );

  const handleSave = async () => {
    if (!endpoint || readOnly) {
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveInfo(null);

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          cuit: formValues.cuit?.trim() || null,
          razonSocial: formValues.razonSocial?.trim() || null,
          arcaStatus: formValues.arcaStatus?.trim() || null,
          dgrStatus: formValues.dgrStatus?.trim() || null,
          fiscalAddressStreet: formValues.fiscalAddressStreet?.trim() || null,
          fiscalAddressNumber: formValues.fiscalAddressNumber?.trim() || null,
          fiscalAddressFloor: formValues.fiscalAddressFloor?.trim() || null,
          fiscalAddressUnit: formValues.fiscalAddressUnit?.trim() || null,
          fiscalAddressLocality: formValues.fiscalAddressLocality?.trim() || null,
          fiscalAddressPostalCode: formValues.fiscalAddressPostalCode?.trim() || null,
          fiscalAddressProvince: formValues.fiscalAddressProvince?.trim() || null,
          activityMainCode: formValues.activityMainCode?.trim() || null,
          activityMainDescription: formValues.activityMainDescription?.trim() || null,
          activityMainSector: formValues.activityMainSector?.trim() || null,
          activityMainStartDate: formValues.activityMainStartDate || null,
          afipKeyStatus: formValues.afipKeyStatus?.trim() || null,
          afipKeyStatusDate: formValues.afipKeyStatusDate || null,
          ivaRegistered: formValues.ivaRegistered,
          ivaWithholdingExclusion: formValues.ivaWithholdingExclusion,
          ivaRegisteredAt: formValues.ivaRegisteredAt || null,
          ivaCondition: formValues.ivaCondition?.trim() || null,
          gananciasRegistered: formValues.gananciasRegistered,
          gananciasWithholdingExclusion: formValues.gananciasWithholdingExclusion,
          gananciasRegisteredAt: formValues.gananciasRegisteredAt || null,
          gananciasCondition: formValues.gananciasCondition?.trim() || null,
          monotributoRegistered: formValues.monotributoRegistered,
          monotributoRegisteredAt: formValues.monotributoRegisteredAt || null,
          monotributoCategory: formValues.monotributoCategory?.trim() || null,
          monotributoType: formValues.monotributoType?.trim() || null,
          monotributoActivity: formValues.monotributoActivity?.trim() || null,
          monotributoSeniorityMonths:
            formValues.monotributoSeniorityMonths == null || Number.isNaN(Number(formValues.monotributoSeniorityMonths))
              ? null
              : Number(formValues.monotributoSeniorityMonths),
          isEmployee: formValues.isEmployee,
          isEmployer: formValues.isEmployer,
          isRetired: formValues.isRetired,
          exclusionNotes: formValues.exclusionNotes?.trim() || null,
          exemptionNotes: formValues.exemptionNotes?.trim() || null,
          regimeNotes: formValues.regimeNotes?.trim() || null,
          bankAccount: formValues.bankAccount?.trim() || null,
          bankAlias: formValues.bankAlias?.trim() || null,
          bankOwnerName: formValues.bankOwnerName?.trim() || null,
          bankOwnerDocument: formValues.bankOwnerDocument?.trim() || null,
          bankValidationStatus: formValues.bankValidationStatus?.trim() || null,
          insuranceNotes: formValues.insuranceNotes?.trim() || null,
          observations: formValues.observations?.trim() || null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data?: TaxProfileRecord };
      applyPayload(payload?.data ?? null);
      setSaveInfo(payload?.message ?? 'Legajo impositivo guardado.');
    } catch (err) {
      setSaveError((err as Error).message ?? 'No se pudo guardar el legajo impositivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshNosis = async () => {
    if (!endpoint) {
      return;
    }

    try {
      setRefreshing(true);
      setRefreshError(null);
      setRefreshInfo(null);

      const response = await fetch(`${endpoint}/nosis-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          cuit: formValues.cuit?.trim() || null,
          razonSocial: formValues.razonSocial?.trim() || null,
          bankAccount: formValues.bankAccount?.trim() || null,
          bankAlias: formValues.bankAlias?.trim() || null,
        }),
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as { message?: string; data?: TaxProfileRecord };
      applyPayload(payload?.data ?? null);
      setRefreshInfo(payload?.message ?? 'Snapshot de Nosis actualizado.');
    } catch (err) {
      setRefreshError((err as Error).message ?? 'No se pudo actualizar Nosis.');
    } finally {
      setRefreshing(false);
    }
  };

  const latestSnapshot = formValues.latestNosisSnapshot ?? null;
  const snapshots = Array.isArray(formValues.snapshots) ? formValues.snapshots : [];
  const documents = Array.isArray(formValues.documents) ? formValues.documents : [];
  const activities = normalizeTaxActivities(formValues.activities);

  const resolveDocumentHref = useCallback(
    (url: string | null) => {
      const resolved = resolveApiUrl(apiBaseUrl, url);
      if (!resolved) {
        return null;
      }
      const token = readAuthTokenFromStorage();
      if (!token) {
        return resolved;
      }
      try {
        const parsed = new URL(resolved, window.location.origin);
        parsed.searchParams.set('api_token', token);
        return parsed.toString();
      } catch {
        return resolved;
      }
    },
    [apiBaseUrl]
  );

  const latestSnapshotSummary = latestSnapshot ? buildTaxSnapshotSummary(latestSnapshot) : null;
  const formatNullableBooleanValue = (value: boolean | null | undefined) =>
    value == null ? '' : String(value);

  const handleUploadDocument = async () => {
    if (entityType !== 'cliente' || !endpoint || !documentFile) {
      setDocumentError('Seleccioná un archivo para adjuntar al legajo.');
      return;
    }

    try {
      setUploadingDocument(true);
      setDocumentError(null);
      setDocumentInfo(null);

      const formData = new FormData();
      formData.append('archivo', documentFile);
      formData.append('title', documentTitle.trim() || documentFile.name);
      formData.append('category', documentCategory);
      if (documentDescription.trim()) {
        formData.append('description', documentDescription.trim());
      }
      if (documentExpiry) {
        formData.append('fechaVencimiento', documentExpiry);
      }

      const response = await fetch(`${endpoint}/documentos`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(actorHeaders ?? {}),
        },
        body: formData,
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = (await parseJsonSafe(response).catch(() => null)) as {
            message?: string;
          } | null;
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const payload = (await parseJsonSafe(response)) as {
        message?: string;
        data?: ClientTaxDocumentRecord;
      };
      setFormValues((prev) => ({
        ...prev,
        documents: payload?.data ? [payload.data, ...(prev.documents ?? [])] : prev.documents ?? [],
      }));
      setDocumentTitle('');
      setDocumentCategory('OTRO');
      setDocumentExpiry('');
      setDocumentDescription('');
      setDocumentFile(null);
      setDocumentInfo(payload?.message ?? 'Documento cargado.');
    } catch (err) {
      setDocumentError((err as Error).message ?? 'No se pudo cargar el documento.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (entityType !== 'cliente' || !endpoint || readOnly) {
      return;
    }

    try {
      setDocumentError(null);
      setDocumentInfo(null);

      const response = await fetch(`${endpoint}/documentos/${documentId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(actorHeaders ?? {}),
        },
      });

      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      setFormValues((prev) => ({
        ...prev,
        documents: (prev.documents ?? []).filter((item) => item.id !== documentId),
      }));
      setDocumentInfo('Documento eliminado correctamente.');
    } catch (err) {
      setDocumentError((err as Error).message ?? 'No se pudo eliminar el documento.');
    }
  };

  return (
    <section className="personal-edit-section">
      <div className="review-comments__header">
        <div>
          <h2>{title}</h2>
          <p className="form-info">{subtitle}</p>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => void fetchProfile()} disabled={loading || refreshing}>
            {loading ? 'Actualizando...' : 'Recargar'}
          </button>
          <button type="button" className="secondary-action" onClick={() => void handleRefreshNosis()} disabled={refreshing || loading}>
            {refreshing ? 'Consultando Nosis...' : 'Actualizar Nosis'}
          </button>
          {!readOnly ? (
            <button type="button" className="primary-action" onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? 'Guardando...' : 'Guardar legajo'}
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? <p className="form-info form-info--error">{loadError}</p> : null}
      {saveError ? <p className="form-info form-info--error">{saveError}</p> : null}
      {refreshError ? <p className="form-info form-info--error">{refreshError}</p> : null}
      {lookupError ? <p className="form-info form-info--error">{lookupError}</p> : null}
      {saveInfo ? <p className="form-info form-info--success">{saveInfo}</p> : null}
      {refreshInfo ? <p className="form-info form-info--success">{refreshInfo}</p> : null}
      {!lookupError && lookupInfo ? <p className="form-info form-info--success">{lookupInfo}</p> : null}

      {loading ? <p className="form-info">Cargando legajo impositivo...</p> : null}

      {!loading ? (
        <>
          <div className="form-grid">
            <label className="input-control">
              <span>{cuitLabel}</span>
              <input
                value={formValues.cuit ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/\D+/g, '').slice(0, 11);
                  setFormValues((prev) => ({ ...prev, cuit: nextValue }));
                  setSaveError(null);
                  setSaveInfo(null);
                  setRefreshError(null);
                  setRefreshInfo(null);
                  setLookupError(null);
                  setLookupInfo(null);
                  lastLookupRef.current = null;
                }}
                disabled={readOnly}
                inputMode="numeric"
                maxLength={11}
              />
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleLookupDocumento(true)}
                disabled={lookupLoading || readOnly || loading}
                style={{ alignSelf: 'flex-start' }}
              >
                {lookupLoading ? 'Consultando...' : 'Autocompletar'}
              </button>
            </label>
            <label className="input-control">
              <span>Razón social</span>
              <input value={formValues.razonSocial ?? ''} onChange={handleInputChange('razonSocial')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Estado ARCA</span>
              <input value={formValues.arcaStatus ?? ''} onChange={handleInputChange('arcaStatus')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Estado DGR</span>
              <input value={formValues.dgrStatus ?? ''} onChange={handleInputChange('dgrStatus')} disabled={readOnly} />
            </label>
          </div>

          <div className="personal-section">
            <h3>Domicilio fiscal</h3>
            <div className="form-grid">
              <label className="input-control">
                <span>Calle</span>
                <input value={formValues.fiscalAddressStreet ?? ''} onChange={handleInputChange('fiscalAddressStreet')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Número</span>
                <input value={formValues.fiscalAddressNumber ?? ''} onChange={handleInputChange('fiscalAddressNumber')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Piso</span>
                <input value={formValues.fiscalAddressFloor ?? ''} onChange={handleInputChange('fiscalAddressFloor')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Departamento</span>
                <input value={formValues.fiscalAddressUnit ?? ''} onChange={handleInputChange('fiscalAddressUnit')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Localidad</span>
                <input value={formValues.fiscalAddressLocality ?? ''} onChange={handleInputChange('fiscalAddressLocality')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Código postal</span>
                <input value={formValues.fiscalAddressPostalCode ?? ''} onChange={handleInputChange('fiscalAddressPostalCode')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Provincia</span>
                <input value={formValues.fiscalAddressProvince ?? ''} onChange={handleInputChange('fiscalAddressProvince')} disabled={readOnly} />
              </label>
            </div>
          </div>

          <div className="personal-section">
            <h3>Actividad AFIP</h3>
            <div className="form-grid">
              <label className="input-control">
                <span>Código actividad principal</span>
                <input value={formValues.activityMainCode ?? ''} onChange={handleInputChange('activityMainCode')} disabled={readOnly} />
              </label>
              <label className="input-control" style={{ gridColumn: 'span 2' }}>
                <span>Descripción actividad principal</span>
                <textarea
                  rows={3}
                  value={formValues.activityMainDescription ?? ''}
                  onChange={handleInputChange('activityMainDescription')}
                  disabled={readOnly}
                  style={{ resize: 'vertical', minHeight: '88px' }}
                />
              </label>
              <label className="input-control">
                <span>Sector</span>
                <input value={formValues.activityMainSector ?? ''} onChange={handleInputChange('activityMainSector')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Fecha inicio</span>
                <input type="date" value={formValues.activityMainStartDate ?? ''} onChange={handleInputChange('activityMainStartDate')} disabled={readOnly} />
              </label>
            </div>
            {activities.length > 1 ? (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Actividades adicionales</h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {activities.slice(1).map((activity, index) => (
                    <div
                      key={`${activity.index ?? index}-${activity.code ?? 'actividad'}`}
                      style={{
                        border: '1px solid var(--color-border, #d8e1ef)',
                        borderRadius: '12px',
                        padding: '0.9rem',
                        background: '#f8fbff',
                      }}
                    >
                      <div className="form-grid">
                        <label className="input-control">
                          <span>Código</span>
                          <input value={activity.code ?? ''} readOnly disabled />
                        </label>
                        <label className="input-control" style={{ gridColumn: 'span 2' }}>
                          <span>Descripción</span>
                          <textarea
                            rows={3}
                            value={activity.description ?? ''}
                            readOnly
                            disabled
                            style={{ resize: 'vertical', minHeight: '88px' }}
                          />
                        </label>
                        <label className="input-control">
                          <span>Sector</span>
                          <input value={activity.sector ?? ''} readOnly disabled />
                        </label>
                        <label className="input-control">
                          <span>Fecha inicio</span>
                          <input type="date" value={activity.startDate ?? ''} readOnly disabled />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="personal-section">
            <h3>Situación fiscal</h3>
            <div className="form-grid">
              <label className="input-control">
                <span>Estado clave AFIP</span>
                <input value={formValues.afipKeyStatus ?? ''} onChange={handleInputChange('afipKeyStatus')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Fecha estado clave AFIP</span>
                <input type="date" value={formValues.afipKeyStatusDate ?? ''} onChange={handleInputChange('afipKeyStatusDate')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Inscripción IVA</span>
                <select value={formatNullableBooleanValue(formValues.ivaRegistered)} onChange={handleNullableBooleanChange('ivaRegistered')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Exclusión retención IVA</span>
                <select value={formatNullableBooleanValue(formValues.ivaWithholdingExclusion)} onChange={handleNullableBooleanChange('ivaWithholdingExclusion')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Fecha inscripción IVA</span>
                <input type="date" value={formValues.ivaRegisteredAt ?? ''} onChange={handleInputChange('ivaRegisteredAt')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Condición IVA</span>
                <input value={formValues.ivaCondition ?? ''} onChange={handleInputChange('ivaCondition')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Inscripción Ganancias</span>
                <select value={formatNullableBooleanValue(formValues.gananciasRegistered)} onChange={handleNullableBooleanChange('gananciasRegistered')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Exclusión retención Ganancias</span>
                <select value={formatNullableBooleanValue(formValues.gananciasWithholdingExclusion)} onChange={handleNullableBooleanChange('gananciasWithholdingExclusion')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Fecha inscripción Ganancias</span>
                <input type="date" value={formValues.gananciasRegisteredAt ?? ''} onChange={handleInputChange('gananciasRegisteredAt')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Condición Ganancias</span>
                <input value={formValues.gananciasCondition ?? ''} onChange={handleInputChange('gananciasCondition')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Monotributista</span>
                <select value={formatNullableBooleanValue(formValues.monotributoRegistered)} onChange={handleNullableBooleanChange('monotributoRegistered')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Fecha alta monotributo</span>
                <input type="date" value={formValues.monotributoRegisteredAt ?? ''} onChange={handleInputChange('monotributoRegisteredAt')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Categoría monotributo</span>
                <input value={formValues.monotributoCategory ?? ''} onChange={handleInputChange('monotributoCategory')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Tipo monotributo</span>
                <input value={formValues.monotributoType ?? ''} onChange={handleInputChange('monotributoType')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Actividad monotributo</span>
                <input value={formValues.monotributoActivity ?? ''} onChange={handleInputChange('monotributoActivity')} disabled={readOnly} />
              </label>
              <label className="input-control">
                <span>Antigüedad monotributo (meses)</span>
                <input
                  type="number"
                  min="0"
                  value={formValues.monotributoSeniorityMonths ?? ''}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      monotributoSeniorityMonths: event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>

          <div className="personal-section">
            <h3>Condición laboral</h3>
            <div className="form-grid">
              <label className="input-control">
                <span>Es empleado</span>
                <select value={formatNullableBooleanValue(formValues.isEmployee)} onChange={handleNullableBooleanChange('isEmployee')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Es empleador</span>
                <select value={formatNullableBooleanValue(formValues.isEmployer)} onChange={handleNullableBooleanChange('isEmployer')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="input-control">
                <span>Es jubilado</span>
                <select value={formatNullableBooleanValue(formValues.isRetired)} onChange={handleNullableBooleanChange('isRetired')} disabled={readOnly}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
          </div>

          <div className="form-grid">
            <label className="input-control">
              <span>Cuenta bancaria</span>
              <input value={formValues.bankAccount ?? ''} onChange={handleInputChange('bankAccount')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Alias bancario</span>
              <input value={formValues.bankAlias ?? ''} onChange={handleInputChange('bankAlias')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Titular cuenta</span>
              <input value={formValues.bankOwnerName ?? ''} onChange={handleInputChange('bankOwnerName')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Documento titular</span>
              <input value={formValues.bankOwnerDocument ?? ''} onChange={handleInputChange('bankOwnerDocument')} disabled={readOnly} />
            </label>
            <label className="input-control">
              <span>Validación bancaria</span>
              <input value={formValues.bankValidationStatus ?? ''} onChange={handleInputChange('bankValidationStatus')} disabled={readOnly} />
            </label>
          </div>

          <div className="form-grid">
            <label className="input-control" style={{ gridColumn: '1 / -1' }}>
              <span>Exclusiones</span>
              <textarea rows={2} value={formValues.exclusionNotes ?? ''} onChange={handleInputChange('exclusionNotes')} disabled={readOnly} />
            </label>
            <label className="input-control" style={{ gridColumn: '1 / -1' }}>
              <span>Exenciones</span>
              <textarea rows={2} value={formValues.exemptionNotes ?? ''} onChange={handleInputChange('exemptionNotes')} disabled={readOnly} />
            </label>
            <label className="input-control" style={{ gridColumn: '1 / -1' }}>
              <span>Regímenes específicos</span>
              <textarea rows={2} value={formValues.regimeNotes ?? ''} onChange={handleInputChange('regimeNotes')} disabled={readOnly} />
            </label>
            <label className="input-control" style={{ gridColumn: '1 / -1' }}>
              <span>Seguros</span>
              <textarea rows={2} value={formValues.insuranceNotes ?? ''} onChange={handleInputChange('insuranceNotes')} disabled={readOnly} />
            </label>
            <label className="input-control" style={{ gridColumn: '1 / -1' }}>
              <span>Observaciones</span>
              <textarea rows={3} value={formValues.observations ?? ''} onChange={handleInputChange('observations')} disabled={readOnly} />
            </label>
          </div>

          {latestSnapshot ? (
            <div className="document-extra-info">
              <p className="form-info">
                Último snapshot Nosis: {latestSnapshotSummary?.typeLabel ?? 'N/D'} · {latestSnapshot.requestedAtLabel ?? 'Sin fecha'}
              </p>
              <p className="form-info">
                Estado: {latestSnapshotSummary?.statusLabel ?? 'N/D'}{latestSnapshotSummary?.resultText ? ` · ${latestSnapshotSummary.resultText}` : ''}
              </p>
              {latestSnapshotSummary?.detailText ? <p className="form-info">{latestSnapshotSummary.detailText}</p> : null}
            </div>
          ) : (
            <p className="form-info">Todavía no hay snapshots guardados de Nosis.</p>
          )}

          {snapshots.length > 0 ? (
            <ul className="document-status-list">
              {snapshots.map((snapshot) =>
                (() => {
                  const summary = buildTaxSnapshotSummary(snapshot);
                  const isLatest = latestSnapshot?.id === snapshot.id;

                  return (
                    <li key={snapshot.id} className="document-status-item">
                      <div className="document-status-info">
                        <span>{summary.typeLabel}</span>
                        <small>{summary.referenceText}</small>
                        {summary.detailText ? <small>{summary.detailText}</small> : null}
                        {summary.resultText ? <small>Resultado: {summary.resultText}</small> : null}
                      </div>
                      <div className="document-status-actions">
                        {isLatest ? <span className="badge">Último</span> : null}
                        <span className={summary.statusClassName}>{summary.statusLabel}</span>
                      </div>
                    </li>
                  );
                })()
              )}
            </ul>
          ) : null}

          {entityType === 'cliente' ? (
            <section className="personal-edit-section">
              <h3>Adjuntos del legajo</h3>
              <p className="form-info">Usá esta sección para constancias, exclusiones, exenciones y regímenes del cliente.</p>
              {documentError ? <p className="form-info form-info--error">{documentError}</p> : null}
              {documentInfo ? <p className="form-info form-info--success">{documentInfo}</p> : null}

              {!readOnly ? (
                <div className="form-grid">
                  <label className="input-control">
                    <span>Categoría</span>
                    <select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}>
                      <option value="OTRO">Otro</option>
                      <option value="CONSTANCIA_ARCA">Constancia ARCA</option>
                      <option value="CONSTANCIA_DGR">Constancia DGR</option>
                      <option value="EXCLUSION">Exclusión</option>
                      <option value="EXENCION">Exención</option>
                      <option value="REGIMEN_ESPECIAL">Régimen especial</option>
                    </select>
                  </label>
                  <label className="input-control">
                    <span>Título</span>
                    <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} />
                  </label>
                  <label className="input-control">
                    <span>Fecha de vencimiento</span>
                    <input type="date" value={documentExpiry} onChange={(event) => setDocumentExpiry(event.target.value)} />
                  </label>
                  <label className="input-control">
                    <span>Archivo</span>
                    <input type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <label className="input-control" style={{ gridColumn: '1 / -1' }}>
                    <span>Descripción</span>
                    <textarea rows={2} value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} />
                  </label>
                </div>
              ) : null}

              {!readOnly ? (
                <div className="form-actions">
                  <button type="button" className="primary-action" onClick={() => void handleUploadDocument()} disabled={uploadingDocument}>
                    {uploadingDocument ? 'Cargando...' : 'Adjuntar documento'}
                  </button>
                </div>
              ) : null}

              {documents.length > 0 ? (
                <ul className="document-status-list">
                  {documents.map((document) => (
                    <li key={document.id} className="document-status-item">
                      <div className="document-status-info">
                        <span>{document.title ?? document.originalName ?? `Documento #${document.id}`}</span>
                        <small>
                          {document.category ?? 'OTRO'}
                          {document.fechaVencimiento ? ` · Vence: ${document.fechaVencimiento}` : ''}
                        </small>
                      </div>
                      <div className="document-status-actions">
                        {document.downloadUrl ? (
                          <a className="secondary-action" href={resolveDocumentHref(document.downloadUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
                            Descargar
                          </a>
                        ) : null}
                        {!readOnly ? (
                          <button type="button" className="secondary-action secondary-action--ghost" onClick={() => void handleDeleteDocument(document.id)}>
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="form-info">Todavía no hay adjuntos cargados en el legajo.</p>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
};


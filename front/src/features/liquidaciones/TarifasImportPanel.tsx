import { useCallback, useEffect, useState } from 'react';

/**
 * SPEC "Importador de Tarifas OCASA" v1.0 (2026-04-21).
 *
 * Panel de 3 etapas (upload → preview → result) para importar desde un xlsx:
 *   - Tarifas BASE + OVERRIDES (con coexistencia para misma ruta+capacidad)
 *   - Motivos YCC exitosos/no-exitosos por cliente
 *   - Mapeo de códigos YCC a materiales tarifarios
 *
 * El preview valida fila por fila y muestra errores accionables antes de persistir.
 * La confirmación va a una transacción atómica con auditoría en liq_tarifas_import_log.
 */

type ResumenCounts = {
  tarifas_base_nuevas: number;
  tarifas_base_actualizar: number;
  overrides_nuevos: number;
  overrides_actualizar: number;
  motivos_nuevos: number;
  motivos_actualizar: number;
  materiales_nuevos: number;
  materiales_actualizar: number;
};

type ItemFila = {
  fila: number;
  hoja: string;
  mensaje: string;
  id?: string | null;
};

type PreviewResponse = {
  preview_token: string;
  resumen: ResumenCounts;
  errores: ItemFila[];
  warnings: ItemFila[];
  expira_en: string;
};

type ResultResponse = {
  aplicadas: number;
  tarifas_base: number;
  overrides: number;
  motivos: number;
  materiales: number;
  log_id: number;
};

type ApiShape = {
  post: (path: string, body: unknown) => Promise<any>;
  postForm: (path: string, fd: FormData) => Promise<any>;
  get: (path: string) => Promise<any>;
};

type Props = {
  esquemaId: number;
  clienteCodigo?: string;
  api: ApiShape;
  apiBaseUrl: string;
  actorHeaders: Record<string, string>;
  onSuccess?: () => void;
};

type Step = 'upload' | 'preview' | 'result';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function TarifasImportPanel({ esquemaId, clienteCodigo = 'OCASA', api, apiBaseUrl, actorHeaders, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [vigDesde, setVigDesde] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [vigHasta, setVigHasta] = useState<string>('');
  const [motivo, setMotivo] = useState<string>(`Importación ${clienteCodigo} ${todayIso()}`);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [aplicarSoloValidas, setAplicarSoloValidas] = useState(false);

  const [result, setResult] = useState<ResultResponse | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setAplicarSoloValidas(false);
  }, []);

  const descargarPlantilla = useCallback(async () => {
    setError(null);
    try {
      const url = `${apiBaseUrl}/api/liq/tarifas/importar/plantilla?cliente=${encodeURIComponent(clienteCodigo)}`;
      const r = await fetch(url, {
        credentials: 'include',
        headers: { Accept: '*/*', ...actorHeaders },
      });
      if (!r.ok) throw new Error(`Error descargando plantilla: ${r.status}`);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `plantilla_tarifas_${clienteCodigo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error descargando plantilla');
    }
  }, [apiBaseUrl, actorHeaders, clienteCodigo]);

  const enviarPreview = useCallback(async () => {
    if (!file) { setError('Seleccioná un archivo Excel'); return; }
    if (!vigDesde) { setError('Vigencia desde es obligatoria'); return; }

    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('esquema_id', String(esquemaId));
      fd.append('vigencia_desde', vigDesde);
      if (vigHasta) fd.append('vigencia_hasta', vigHasta);
      if (motivo.trim()) fd.append('motivo', motivo.trim());

      const res: PreviewResponse = await api.postForm('/tarifas/importar/preview', fd);
      setPreview(res);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error validando archivo');
    } finally {
      setLoading(false);
    }
  }, [api, file, esquemaId, vigDesde, vigHasta, motivo]);

  const confirmar = useCallback(async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/tarifas/importar/confirmar', {
        preview_token: preview.preview_token,
        aplicar_solo_validas: aplicarSoloValidas,
      });
      setResult(res.data);
      setStep('result');
      if (onSuccess) onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error confirmando importación');
    } finally {
      setLoading(false);
    }
  }, [api, preview, aplicarSoloValidas, onSuccess]);

  const tieneErrores = (preview?.errores?.length ?? 0) > 0;
  const puedeConfirmar = preview && (!tieneErrores || aplicarSoloValidas);

  return (
    <div className="dashboard-card" style={{ borderLeft: '4px solid #1E40AF' }}>
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Importar tarifas (BASE + OVERRIDES + Motivos + Materiales)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {step !== 'upload' && (
            <button type="button" className="btn-secondary" onClick={reset}>Empezar de nuevo</button>
          )}
          <button type="button" className="btn-secondary" onClick={() => void descargarPlantilla()}>
            Descargar plantilla xlsx
          </button>
        </div>
      </header>

      <div className="card-body">
        {error && (
          <div style={{
            padding: 10, background: '#fee2e2', border: '1px solid #fca5a5',
            borderRadius: 6, color: '#991b1b', fontSize: 13, marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <StepIndicator step={step} />

        {step === 'upload' && (
          <UploadStep
            file={file} setFile={setFile}
            vigDesde={vigDesde} setVigDesde={setVigDesde}
            vigHasta={vigHasta} setVigHasta={setVigHasta}
            motivo={motivo} setMotivo={setMotivo}
            loading={loading} onSubmit={() => void enviarPreview()}
          />
        )}

        {step === 'preview' && preview && (
          <PreviewStep
            preview={preview}
            aplicarSoloValidas={aplicarSoloValidas}
            setAplicarSoloValidas={setAplicarSoloValidas}
            puedeConfirmar={!!puedeConfirmar}
            loading={loading}
            onConfirmar={() => void confirmar()}
            onCancelar={() => setStep('upload')}
          />
        )}

        {step === 'result' && result && (
          <ResultStep result={result} onNuevo={reset} />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-componentes
// -----------------------------------------------------------------------------

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '1. Subir archivo' },
    { key: 'preview', label: '2. Revisar' },
    { key: 'result', label: '3. Confirmado' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {steps.map((s, i) => {
        const active = s.key === step;
        const done = steps.findIndex(x => x.key === step) > i;
        return (
          <div key={s.key} style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: active ? 600 : 400,
            textAlign: 'center',
            background: active ? '#1E40AF' : done ? '#10b981' : '#e5e7eb',
            color: (active || done) ? '#fff' : '#6b7280',
          }}>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

function UploadStep({
  file, setFile, vigDesde, setVigDesde, vigHasta, setVigHasta,
  motivo, setMotivo, loading, onSubmit,
}: {
  file: File | null; setFile: (f: File | null) => void;
  vigDesde: string; setVigDesde: (s: string) => void;
  vigHasta: string; setVigHasta: (s: string) => void;
  motivo: string; setMotivo: (s: string) => void;
  loading: boolean; onSubmit: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 1.6fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Archivo .xlsx *</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ width: '100%' }}
          />
          {file && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Vigencia desde *</label>
          <input type="date" className="form-input" value={vigDesde} onChange={(e) => setVigDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Vigencia hasta</label>
          <input type="date" className="form-input" value={vigHasta} onChange={(e) => setVigHasta(e.target.value)} placeholder="Sin límite" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Motivo</label>
          <input type="text" className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !file || !vigDesde}
          onClick={onSubmit}
        >
          {loading ? 'Validando...' : 'Validar e importar'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          El archivo se valida sin persistir; revisás el resumen antes de confirmar.
        </span>
      </div>
    </div>
  );
}

function PreviewStep({
  preview, aplicarSoloValidas, setAplicarSoloValidas,
  puedeConfirmar, loading, onConfirmar, onCancelar,
}: {
  preview: PreviewResponse;
  aplicarSoloValidas: boolean;
  setAplicarSoloValidas: (v: boolean) => void;
  puedeConfirmar: boolean;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const r = preview.resumen;
  const totalNuevos = r.tarifas_base_nuevas + r.overrides_nuevos + r.motivos_nuevos + r.materiales_nuevos;
  const totalActualizar = r.tarifas_base_actualizar + r.overrides_actualizar + r.motivos_actualizar + r.materiales_actualizar;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Resumen a aplicar</h4>
          <ResumenLine label="Tarifas BASE nuevas" value={r.tarifas_base_nuevas} color="#10b981" />
          <ResumenLine label="Tarifas BASE a actualizar" value={r.tarifas_base_actualizar} color="#f59e0b" />
          <ResumenLine label="Overrides nuevos" value={r.overrides_nuevos} color="#10b981" />
          <ResumenLine label="Overrides a actualizar" value={r.overrides_actualizar} color="#f59e0b" />
          <ResumenLine label="Motivos nuevos" value={r.motivos_nuevos} color="#10b981" />
          <ResumenLine label="Motivos a actualizar" value={r.motivos_actualizar} color="#f59e0b" />
          <ResumenLine label="Materiales nuevos" value={r.materiales_nuevos} color="#10b981" />
          <ResumenLine label="Materiales a actualizar" value={r.materiales_actualizar} color="#f59e0b" />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Total:</span>
            <span>{totalNuevos} nuevos · {totalActualizar} actualizar</span>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Errores ({preview.errores.length}) · Warnings ({preview.warnings.length})
          </h4>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
            {preview.errores.length === 0 && preview.warnings.length === 0 && (
              <div style={{ color: '#10b981', fontSize: 13, padding: 8 }}>✓ Sin errores ni warnings.</div>
            )}
            {preview.errores.map((e, i) => (
              <ItemMensaje key={`e-${i}`} item={e} tipo="error" />
            ))}
            {preview.warnings.map((w, i) => (
              <ItemMensaje key={`w-${i}`} item={w} tipo="warning" />
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={aplicarSoloValidas}
            onChange={(e) => setAplicarSoloValidas(e.target.checked)}
            disabled={preview.errores.length === 0}
          />
          Aplicar solo filas sin error (ignorar las {preview.errores.length} con error)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onCancelar} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirmar}
            disabled={!puedeConfirmar || loading}
            title={!puedeConfirmar ? 'Corregí los errores o marcá "Aplicar solo válidas"' : ''}
          >
            {loading ? 'Aplicando...' : 'Confirmar y aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResumenLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: value > 0 ? '#111827' : '#9ca3af' }}>{label}</span>
      <span style={{ fontWeight: 600, color: value > 0 ? color : '#9ca3af' }}>{value}</span>
    </div>
  );
}

function ItemMensaje({ item, tipo }: { item: ItemFila; tipo: 'error' | 'warning' }) {
  const color = tipo === 'error' ? '#991b1b' : '#92400e';
  const bg = tipo === 'error' ? '#fee2e2' : '#fef3c7';
  return (
    <div style={{ background: bg, color, padding: '6px 8px', marginBottom: 4, borderRadius: 4, fontSize: 12 }}>
      <strong>Fila {item.fila}</strong>
      {item.hoja && ` · ${item.hoja}`}
      {item.id && ` · ${item.id}`}
      <div style={{ marginTop: 2 }}>{item.mensaje}</div>
    </div>
  );
}

function ResultStep({ result, onNuevo }: { result: ResultResponse; onNuevo: () => void }) {
  return (
    <div>
      <div style={{
        padding: 16, background: '#d1fae5', border: '1px solid #10b981',
        borderRadius: 6, marginBottom: 12,
      }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#065f46' }}>
          ✓ {result.aplicadas} filas importadas
        </h4>
        <div style={{ fontSize: 13, color: '#065f46' }}>
          {result.tarifas_base > 0 && <div>• {result.tarifas_base} tarifas BASE</div>}
          {result.overrides > 0 && <div>• {result.overrides} overrides</div>}
          {result.motivos > 0 && <div>• {result.motivos} motivos YCC</div>}
          {result.materiales > 0 && <div>• {result.materiales} mapeos de material</div>}
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
            Registro de auditoría: log_id = {result.log_id}
          </div>
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={onNuevo}>
        Importar otro archivo
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Log list
// -----------------------------------------------------------------------------

export function TarifasImportLogList({ api, clienteId }: { api: ApiShape; clienteId?: number }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const path = clienteId
        ? `/tarifas/importar/log?cliente_id=${clienteId}&limit=20`
        : `/tarifas/importar/log?limit=20`;
      const r = await api.get(path);
      setLogs(r.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [api, clienteId]);

  useEffect(() => { void recargar(); }, [recargar]);

  if (loading && logs.length === 0) return <div style={{ fontSize: 13, color: '#6b7280' }}>Cargando historial...</div>;
  if (logs.length === 0) return <div style={{ fontSize: 13, color: '#6b7280' }}>Sin importaciones previas.</div>;

  return (
    <div className="dashboard-card">
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Historial de importaciones</h3>
        <button type="button" className="btn-secondary" onClick={() => void recargar()}>Refrescar</button>
      </header>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="table" style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Cliente</th>
              <th>Archivo</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>OK</th>
              <th style={{ textAlign: 'right' }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at ? new Date(l.created_at).toLocaleString('es-AR') : '—'}</td>
                <td>{l.usuario}</td>
                <td>{l.cliente}</td>
                <td style={{ fontFamily: 'monospace' }}>{l.archivo_nombre}</td>
                <td>{l.tipo_import}</td>
                <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{l.filas_ok}</td>
                <td style={{ textAlign: 'right', color: l.filas_error > 0 ? '#ef4444' : '#9ca3af' }}>{l.filas_error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

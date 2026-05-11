import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
};

type TipoTest = 'envio_basico' | 'loop_completo' | 'con_adjunto';
type EstadoTest = 'en_progreso' | 'ok' | 'error';

type TestRow = {
  id: number;
  tipo_test: TipoTest;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_ms: number | null;
  estado: EstadoTest;
  paso_fallo: string | null;
  detalle_error: string | null;
  metadata: Record<string, unknown> | null;
};

type OAuthStatus = {
  vinculado: boolean;
  email?: string | null;
  activo?: boolean;
};

const fmtFecha = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
};

const fmtDuracion = (ms: number | null): string => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const labelTipo = (t: TipoTest): string => ({
  envio_basico: 'Envío básico',
  loop_completo: 'Loop completo',
  con_adjunto: 'Con adjunto',
}[t]);

/**
 * ADDENDUM 14 Parte A — Pantalla de tests E2E del flujo de correos.
 *
 * 3 botones para validar que el OAuth + Microsoft Graph + permisos Mail.Send/Mail.Read
 * funcionan end-to-end. Pensado para diagnosticar antes de mandar solicitudes reales.
 */
export const PolizaTestCorreosPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [destinatario, setDestinatario] = useState('');
  const [tests, setTests] = useState<TestRow[]>([]);
  const [enEjecucion, setEnEjecucion] = useState<TipoTest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [resp1, resp2] = await Promise.all([
        fetch(`${apiBaseUrl}/api/oauth/microsoft/status`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/polizas/test-correos/ultimos`, { cache: 'no-store' }),
      ]);
      if (resp1.ok) {
        const { data } = await resp1.json();
        setOauth(data);
        if (data?.email && !destinatario) setDestinatario(data.email);
      }
      if (resp2.ok) {
        const { data } = await resp2.json();
        setTests(data ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apiBaseUrl, destinatario]);

  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = useCallback(async (tipo: TipoTest) => {
    setEnEjecucion(tipo);
    setError(null);
    try {
      const url = `${apiBaseUrl}/api/polizas/test-correos/${
        tipo === 'envio_basico' ? 'envio-basico' :
        tipo === 'loop_completo' ? 'loop-completo' : 'con-adjunto'
      }`;
      const body = tipo === 'envio_basico' ? JSON.stringify({ destinatario }) : '{}';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!resp.ok) throw new Error(await resp.text());
      await cargar();
    } catch (e) {
      setError(`Test ${labelTipo(tipo)} falló: ${(e as Error).message}`);
    } finally {
      setEnEjecucion(null);
    }
  }, [apiBaseUrl, cargar, destinatario]);

  const ultimoOk = tests.find((t) => t.estado === 'ok');
  const oauthOk = oauth?.vinculado && oauth?.activo;

  return (
    <DashboardLayout title="Test de correos" subtitle="Validación E2E del flujo OAuth + Microsoft Graph">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/polizas" className="text-sm text-indigo-600 hover:underline">← Volver a Pólizas</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 whitespace-pre-wrap">{error}</div>
      )}

      <div className={`mb-4 rounded-md border p-3 text-sm ${
        oauthOk ? 'border-green-300 bg-green-50 text-green-800' : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}>
        {oauthOk ? (
          <>✅ Mi cuenta vinculada: <strong>{oauth?.email}</strong></>
        ) : (
          <>
            ⚠ No tenés cuenta OAuth activa. Vinculá tu Outlook primero:{' '}
            <Link to="/polizas/configuracion/mi-outlook" className="underline">Ir a vincular</Link>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Test 1 */}
        <TestCard
          titulo="Test 1: Envío básico"
          descripcion="Envía un email simple a la dirección que elijas (default: tu propia casilla)."
          ultimoResultado={tests.find((t) => t.tipo_test === 'envio_basico')}
          loading={enEjecucion === 'envio_basico'}
          deshabilitado={!oauthOk || enEjecucion !== null}
          onEjecutar={() => ejecutar('envio_basico')}
        >
          <label className="block text-xs text-slate-500 mb-0.5">Destinatario</label>
          <input
            type="email"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder={oauth?.email ?? 'tu@email.com'}
            className="w-full rounded border-slate-300 text-sm"
          />
        </TestCard>

        {/* Test 2 */}
        <TestCard
          titulo="Test 2: Loop completo"
          descripcion="Envía un email a tu propia cuenta y valida que aparece en SentItems (máx 60s). Verifica Mail.Send + Mail.Read."
          ultimoResultado={tests.find((t) => t.tipo_test === 'loop_completo')}
          loading={enEjecucion === 'loop_completo'}
          deshabilitado={!oauthOk || enEjecucion !== null}
          onEjecutar={() => ejecutar('loop_completo')}
        >
          <div className="text-xs text-slate-500">El test puede tardar hasta 60s — el servidor hace polling cada 5s.</div>
        </TestCard>

        {/* Test 3 */}
        <TestCard
          titulo="Test 3: Con adjunto"
          descripcion="Envía un PDF de muestra como adjunto para verificar que la subida funciona."
          ultimoResultado={tests.find((t) => t.tipo_test === 'con_adjunto')}
          loading={enEjecucion === 'con_adjunto'}
          deshabilitado={!oauthOk || enEjecucion !== null}
          onEjecutar={() => ejecutar('con_adjunto')}
        >
          <div className="text-xs text-slate-500">Adjunto: PDF mínimo (~500 bytes) generado on-the-fly.</div>
        </TestCard>
      </div>

      {ultimoOk && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✓ Último test exitoso: <strong>{labelTipo(ultimoOk.tipo_test)}</strong> · {fmtFecha(ultimoOk.fecha_inicio)} · duración {fmtDuracion(ultimoOk.duracion_ms)}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Historial de tests</h3>
        <button onClick={cargar} className="text-xs text-indigo-600 hover:underline">⟳ Refrescar</button>
      </div>
      {tests.length === 0 ? (
        <div className="text-sm text-slate-500">Todavía no ejecutaste ningún test.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Inicio</th>
                <th className="px-3 py-2 text-left">Duración</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Paso fallo</th>
                <th className="px-3 py-2 text-left">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">{labelTipo(t.tipo_test)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(t.fecha_inicio)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDuracion(t.duracion_ms)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      t.estado === 'ok' ? 'bg-green-100 text-green-800' :
                      t.estado === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>{t.estado === 'ok' ? '✅ OK' : t.estado === 'error' ? '❌ Error' : '⏳ En curso'}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.paso_fallo ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-md truncate" title={t.detalle_error ?? ''}>
                    {t.detalle_error ?? (t.metadata ? JSON.stringify(t.metadata) : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
};

const TestCard: React.FC<{
  titulo: string;
  descripcion: string;
  ultimoResultado?: TestRow;
  loading: boolean;
  deshabilitado: boolean;
  onEjecutar: () => void;
  children?: React.ReactNode;
}> = ({ titulo, descripcion, ultimoResultado, loading, deshabilitado, onEjecutar, children }) => (
  <div className="rounded-md border border-slate-200 bg-white p-4 flex flex-col gap-3">
    <div>
      <div className="text-sm font-semibold">{titulo}</div>
      <div className="text-xs text-slate-500 mt-1">{descripcion}</div>
    </div>
    {children && <div>{children}</div>}
    <button
      onClick={onEjecutar}
      disabled={deshabilitado}
      className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? '▶ Ejecutando…' : '▶ Ejecutar test'}
    </button>
    {ultimoResultado && (
      <div className={`text-xs rounded px-2 py-1.5 ${
        ultimoResultado.estado === 'ok' ? 'bg-green-50 text-green-800' :
        ultimoResultado.estado === 'error' ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700'
      }`}>
        <div>Último: {ultimoResultado.estado === 'ok' ? '✓' : ultimoResultado.estado === 'error' ? '✗' : '⏳'} · {fmtFecha(ultimoResultado.fecha_inicio)}</div>
        {ultimoResultado.duracion_ms !== null && <div>Duración: {fmtDuracion(ultimoResultado.duracion_ms)}</div>}
        {ultimoResultado.detalle_error && (
          <div className="mt-1 italic" title={ultimoResultado.detalle_error}>{ultimoResultado.detalle_error.slice(0, 150)}</div>
        )}
      </div>
    )}
  </div>
);

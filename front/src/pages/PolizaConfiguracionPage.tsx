import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Poliza, PolizaEmailConfig, TipoEmail } from '../features/polizas/types';

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

/**
 * ADDENDUM 12 Parte C — pantalla de configuración de email por póliza.
 *
 * Antes de este addendum, el endpoint `PUT /api/polizas/{id}/email-config/{tipo}`
 * existía pero no había UI — los emails TO/CC se editaban solo desde seeder o
 * con un comando artisan. Esta pantalla permite editarlos desde el navegador.
 *
 * Tabs Alta / Baja con todos los campos editables:
 *  - Destinatarios (TO/CC/BCC) como chips removibles + input para agregar.
 *  - Contacto, asunto, body y templates de asegurado.
 *  - Adjuntos requeridos (categorías de archivo) como chips.
 *  - Botón "Probar con destinatario" que dispara `POST /email-config/{id}/probar`.
 *
 * Requiere permiso `puede_editar_email_config` (validado server-side).
 */
export const PolizaConfiguracionPage: React.FC<Props> = ({ DashboardLayout, resolveApiBaseUrl }) => {
  const { polizaId } = useParams<{ polizaId: string }>();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);

  const [poliza, setPoliza] = useState<Poliza | null>(null);
  const [tipo, setTipo] = useState<TipoEmail>('alta');
  const [config, setConfig] = useState<PolizaEmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Form state — editable. Se inicializa desde el config cargado.
  const [destTo, setDestTo] = useState<string[]>([]);
  const [destCc, setDestCc] = useState<string[]>([]);
  const [destBcc, setDestBcc] = useState<string[]>([]);
  const [contactoNombre, setContactoNombre] = useState('');
  const [asunto, setAsunto] = useState('');
  const [body, setBody] = useState('');
  const [aseguradoTpl, setAseguradoTpl] = useState('');
  const [separador, setSeparador] = useState('\n');
  const [adjuntos, setAdjuntos] = useState<string[]>([]);

  // Inputs temporales para agregar nuevos chips.
  const [nuevoTo, setNuevoTo] = useState('');
  const [nuevoCc, setNuevoCc] = useState('');
  const [nuevoBcc, setNuevoBcc] = useState('');
  const [nuevoAdj, setNuevoAdj] = useState('');

  // Modal "Probar con destinatario".
  const [probarEmail, setProbarEmail] = useState('');
  const [probando, setProbando] = useState(false);

  const cargar = useCallback(async () => {
    if (!polizaId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const { data } = (await resp.json()) as { data: Poliza & { email_configs?: PolizaEmailConfig[] } };
      setPoliza(data);
      const c = (data.email_configs ?? []).find((cf) => cf.tipo === tipo);
      if (c) {
        setConfig(c);
        setDestTo(c.destinatarios_to ?? []);
        setDestCc(c.destinatarios_cc ?? []);
        setDestBcc(c.destinatarios_bcc ?? []);
        setContactoNombre(c.contacto_nombre ?? '');
        setAsunto(c.asunto_template ?? '');
        setBody(c.body_template ?? '');
        setAseguradoTpl(c.asegurado_template ?? '');
        // El separador no aparece en el type pero se usa en seeders. Default \n.
        setSeparador((c as { separador_entre_asegurados?: string }).separador_entre_asegurados ?? '\n');
        setAdjuntos(c.adjuntos_requeridos ?? []);
      } else if (tipo === 'combinado') {
        // ADDENDUM 16 Parte B: la fila combinado puede no existir todavía;
        // dejamos los campos vacíos para que el admin la cree desde acá.
        // El backend acepta crearla on-demand en PUT email-config/combinado.
        setConfig({
          id: 0, poliza_id: data.id, tipo: 'combinado',
          destinatarios_to: [], destinatarios_cc: [], destinatarios_bcc: [],
          contacto_nombre: null, asunto_template: '', body_template: '',
          asegurado_template: '', adjuntos_requeridos: [], activo: false,
        });
        setDestTo([]); setDestCc([]); setDestBcc([]);
        setContactoNombre(''); setAsunto(''); setBody('');
        setAseguradoTpl(''); setSeparador('\n'); setAdjuntos([]);
      } else {
        setConfig(null);
        setError(`No existe email_config para tipo "${tipo}" en esta póliza.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [polizaId, apiBaseUrl, tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!polizaId || !config) return;
    if (destTo.length === 0) {
      setError('Tenés que tener al menos un destinatario en TO.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/${polizaId}/email-config/${tipo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatarios_to: destTo,
          destinatarios_cc: destCc,
          destinatarios_bcc: destBcc,
          contacto_nombre: contactoNombre || null,
          asunto_template: asunto,
          body_template: body,
          asegurado_template: aseguradoTpl,
          separador_entre_asegurados: separador,
          adjuntos_requeridos: adjuntos,
        }),
      });
      if (resp.status === 403) {
        throw new Error('No tenés permiso `puede_editar_email_config`. Pedí al admin que te lo asigne.');
      }
      if (!resp.ok) {
        const t = await resp.text();
        let msg = t;
        try { msg = JSON.parse(t)?.message ?? t; } catch { /* noop */ }
        throw new Error(msg);
      }
      setOkMsg('Configuración guardada.');
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const probar = async () => {
    if (!config || !probarEmail.trim()) return;
    setProbando(true);
    setError(null);
    setOkMsg(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/polizas/email-config/${config.id}/probar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatario_test: probarEmail.trim() }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        let msg = t;
        try { msg = JSON.parse(t)?.message ?? t; } catch { /* noop */ }
        throw new Error(msg);
      }
      setOkMsg(`Email de prueba enviado a ${probarEmail.trim()}.`);
      setProbarEmail('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProbando(false);
    }
  };

  const agregarChip = (lista: string[], setter: (v: string[]) => void, valor: string, resetInput: () => void) => {
    const v = valor.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(`"${v}" no parece un email válido.`);
      return;
    }
    if (lista.includes(v)) {
      setError(`"${v}" ya está en la lista.`);
      return;
    }
    setter([...lista, v]);
    resetInput();
    setError(null);
  };

  const removerChip = (lista: string[], setter: (v: string[]) => void, valor: string) => {
    setter(lista.filter((x) => x !== valor));
  };

  return (
    <DashboardLayout
      title={`Configuración email — ${poliza?.nombre_descriptivo ?? 'Póliza'}`}
      subtitle={poliza ? `${poliza.aseguradora?.nombre} · N° ${poliza.numero_poliza}` : ''}
      headerContent={
        <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
          ← Volver
        </Link>
      }
    >
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee', color: '#900', borderRadius: 12, marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {okMsg && (
        <div style={{ padding: '0.75rem 1rem', background: '#e7f7ed', color: '#0a8c3a', borderRadius: 12, marginBottom: '1rem' }}>
          {okMsg}
        </div>
      )}

      {/* Selector tipo (alta / baja / combinado). */}
      <div className="liq-tabbar" style={{ marginBottom: '1rem' }}>
        {(['alta', 'baja', 'combinado'] as TipoEmail[]).map((t) => (
          <button
            key={t}
            type="button"
            className="tab-btn"
            onClick={() => setTipo(t)}
            style={tipo === t ? { background: '#1d74f5', color: '#fff' } : undefined}
          >
            {t === 'combinado' ? 'Correo combinado (Altas+Bajas)' : `Email de ${t}`}
          </button>
        ))}
      </div>

      {/* ADDENDUM 16 Parte B — explicación corta del modo combinado. */}
      {tipo === 'combinado' && (
        <div className="dashboard-card" style={{ marginBottom: '1rem', background: '#f4f7ff' }}>
          <h3 style={{ margin: 0 }}>¿Cómo funciona el correo combinado?</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#444' }}>
            Si esta póliza tiene casilla y asunto configurados acá, en la pantalla de envío
            aparece la opción de mandar Altas y Bajas en un solo correo (en vez de los dos
            separados de siempre). El cuerpo se arma combinando una sección <b>ALTAS</b> y
            otra <b>BAJAS</b>, cada una con la tabla configurada en sus respectivos tabs.
          </p>
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#444' }}>
            Placeholders especiales en el body de combinado:&nbsp;
            <code>{'{altas_block}'}</code>&nbsp;y&nbsp;<code>{'{bajas_block}'}</code>.
            (No se usan <code>{'{asegurados_block}'}</code> ni el template por asegurado
            de esta fila — los toma del tab Alta y Baja respectivamente.)
          </p>
        </div>
      )}

      {loading && <div style={{ padding: '1rem', color: '#666' }}>Cargando…</div>}

      {!loading && config && (
        <>
          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Destinatarios</h3>
            <ChipList label="To (obligatorio, al menos 1)" valores={destTo}
              setValores={setDestTo} placeholder="ej: carlos@mapfre.com.ar"
              nuevoVal={nuevoTo} setNuevoVal={setNuevoTo}
              onAgregar={() => agregarChip(destTo, setDestTo, nuevoTo, () => setNuevoTo(''))}
              onRemover={(v) => removerChip(destTo, setDestTo, v)}
            />
            <ChipList label="CC" valores={destCc}
              setValores={setDestCc} placeholder="ej: comercial@..."
              nuevoVal={nuevoCc} setNuevoVal={setNuevoCc}
              onAgregar={() => agregarChip(destCc, setDestCc, nuevoCc, () => setNuevoCc(''))}
              onRemover={(v) => removerChip(destCc, setDestCc, v)}
            />
            <ChipList label="BCC (opcional, oculto a destinatarios)" valores={destBcc}
              setValores={setDestBcc} placeholder="ej: copia@..."
              nuevoVal={nuevoBcc} setNuevoVal={setNuevoBcc}
              onAgregar={() => agregarChip(destBcc, setDestBcc, nuevoBcc, () => setNuevoBcc(''))}
              onRemover={(v) => removerChip(destBcc, setDestBcc, v)}
            />
            <label className="input-control" style={{ display: 'block', marginTop: '0.5rem' }}>
              <span>Contacto (nombre)</span>
              <input type="text" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)}
                placeholder="ej: Carlos / Ramón" />
            </label>
          </div>

          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Templates</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0 0.5rem 0' }}>
              Placeholders disponibles: <code>{'{numero_poliza}'}</code> <code>{'{numero_cuenta}'}</code> <code>{'{contacto_nombre}'}</code> <code>{'{fecha_solicitud}'}</code> <code>{'{aseguradora}'}</code> <code>{'{ramo}'}</code> <code>{'{vigencia_hasta}'}</code> <code>{'{texto_clausula_previa}'}</code> <code>{'{clausula_global_block}'}</code> <code>{'{texto_clausula_la_segunda}'}</code> <code>{'{asegurados_block}'}</code>
            </p>
            <label className="input-control" style={{ display: 'block' }}>
              <span>Asunto</span>
              <input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </label>
            <label className="input-control" style={{ display: 'block', marginTop: '0.5rem' }}>
              <span>Body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </label>
            <label className="input-control" style={{ display: 'block', marginTop: '0.5rem' }}>
              <span>Template por asegurado (se repite por cada uno en el body)</span>
              <textarea
                value={aseguradoTpl}
                onChange={(e) => setAseguradoTpl(e.target.value)}
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <small style={{ color: '#666' }}>
                Placeholders: <code>{'{nombre_apellido}'}</code> <code>{'{cuil}'}</code> <code>{'{cuil_sin_guiones}'}</code> <code>{'{dni}'}</code> <code>{'{dni_con_puntos}'}</code> <code>{'{patente}'}</code> <code>{'{fecha_nac}'}</code> <code>{'{numero_orden_aseguradora}'}</code> <code>{'{clausula_inline}'}</code> <code>{'{numero_asegurado}'}</code>
              </small>
            </label>
            <label className="input-control" style={{ display: 'block', marginTop: '0.5rem', maxWidth: 240 }}>
              <span>Separador entre asegurados</span>
              <select value={separador} onChange={(e) => setSeparador(e.target.value)}>
                <option value={'\n'}>Salto de línea simple (\n)</option>
                <option value={'\n\n'}>Doble salto (\n\n)</option>
                <option value={', '}>Coma + espacio</option>
              </select>
            </label>
          </div>

          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Adjuntos requeridos</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0 0.5rem 0' }}>
              Slugs de la categoría del archivo en `archivos.categoria`. Si la lista está vacía, no se exigen adjuntos.
              Slugs típicos: <code>foto_frente</code>, <code>foto_lateral_der</code>, <code>foto_lateral_izq</code>, <code>foto_trasera</code>, <code>cedula_frente</code>, <code>cedula_dorso</code>.
            </p>
            <ChipList label="Categorías" valores={adjuntos}
              setValores={setAdjuntos} placeholder="ej: foto_frente"
              nuevoVal={nuevoAdj} setNuevoVal={setNuevoAdj}
              onAgregar={() => {
                const v = nuevoAdj.trim();
                if (!v) return;
                if (adjuntos.includes(v)) return;
                setAdjuntos([...adjuntos, v]);
                setNuevoAdj('');
              }}
              onRemover={(v) => setAdjuntos(adjuntos.filter((x) => x !== v))}
              skipEmailValidation
            />
          </div>

          {tipo !== 'combinado' && (
          <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Probar configuración</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0 0.5rem 0' }}>
              Manda un email <code>[PRUEBA]</code> a una casilla específica usando esta config.
              No afecta a los destinatarios reales — sirve para validar conectividad.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="input-control" style={{ flex: '1 1 280px' }}>
                <span>Destinatario de prueba</span>
                <input
                  type="email"
                  value={probarEmail}
                  onChange={(e) => setProbarEmail(e.target.value)}
                  placeholder="tu-email@logisticaargentinasrl.com.ar"
                />
              </label>
              <button
                type="button"
                onClick={probar}
                disabled={probando || !probarEmail.trim()}
                style={{
                  background: probando || !probarEmail.trim() ? '#aaa' : '#1d74f5',
                  color: '#fff', padding: '0.5rem 1rem', borderRadius: 8, border: 0, cursor: 'pointer',
                }}
              >
                {probando ? 'Enviando…' : 'Enviar prueba'}
              </button>
            </div>
          </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Link to={polizaId ? `/polizas/${polizaId}` : '/polizas'} className="secondary-action secondary-action--ghost">
              Cancelar
            </Link>
            <button
              type="button"
              onClick={guardar}
              disabled={saving}
              style={{
                background: saving ? '#aaa' : '#0a8c3a', color: '#fff',
                padding: '0.6rem 1.2rem', borderRadius: 10, border: 0, cursor: 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

// ─── Lista editable de chips (emails o slugs) ────────────────────────────────

const ChipList: React.FC<{
  label: string;
  valores: string[];
  setValores: (v: string[]) => void;
  placeholder: string;
  nuevoVal: string;
  setNuevoVal: (v: string) => void;
  onAgregar: () => void;
  onRemover: (v: string) => void;
  skipEmailValidation?: boolean;
}> = ({ label, valores, placeholder, nuevoVal, setNuevoVal, onAgregar, onRemover }) => (
  <div style={{ marginBottom: '0.6rem' }}>
    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
      {valores.length === 0 && <small style={{ color: '#888', fontStyle: 'italic' }}>(vacío)</small>}
      {valores.map((v) => (
        <span
          key={v}
          style={{
            background: '#eef4ff', color: '#1e3a8a', padding: '0.25rem 0.5rem',
            borderRadius: 6, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          }}
        >
          <code style={{ background: 'transparent', padding: 0 }}>{v}</code>
          <button
            type="button"
            onClick={() => onRemover(v)}
            aria-label={`Quitar ${v}`}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#1e3a8a', fontWeight: 'bold' }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
    <div style={{ display: 'flex', gap: '0.3rem' }}>
      <input
        type="text"
        value={nuevoVal}
        onChange={(e) => setNuevoVal(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAgregar(); } }}
        style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #d0d7e1' }}
      />
      <button
        type="button"
        onClick={onAgregar}
        disabled={!nuevoVal.trim()}
        style={{
          background: !nuevoVal.trim() ? '#aaa' : '#1d74f5', color: '#fff',
          padding: '0.35rem 0.75rem', borderRadius: 6, border: 0, cursor: 'pointer', fontSize: '0.85rem',
        }}
      >
        Agregar
      </button>
    </div>
  </div>
);

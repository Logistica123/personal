import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { LiqLineaTarifa } from './types';

type ApiLike = {
  get: (path: string) => Promise<any>;
  put: (path: string, body?: unknown) => Promise<any>;
};

type Props = {
  api: ApiLike;
  linea: LiqLineaTarifa;
  dimensiones: string[];
  isOcasa: boolean;
  onClose: () => void;
  onSaved: () => void;
  formatDate?: (s: string) => string;
};

type HistorialEntry = {
  id: number;
  accion: string;
  motivo: string | null;
  usuario: { id: number; name: string; email: string } | null;
  created_at: string;
  campos_modificados: Record<string, { antes: unknown; despues: unknown }>;
  valores_anteriores: Record<string, unknown>;
  valores_nuevos: Record<string, unknown>;
};

const FIELD_LABELS: Record<string, string> = {
  precio_original: 'Precio original',
  porcentaje_agencia: '% Agencia',
  precio_distribuidor: 'Precio distribuidor',
  vigencia_desde: 'Vigencia desde',
  vigencia_hasta: 'Vigencia hasta',
  modelo_tarifa: 'Modelo tarifa',
  costo_fijo_base: 'Costo fijo base',
  tarifa_km_original: '$/km original',
  tarifa_km_distribuidor: '$/km distribuidor',
  umbral_km: 'Umbral km',
  modo_productividad: 'Modo productividad',
  tarifa_parada_distrib: '$ por parada',
  tarifa_bulto_distrib: '$ por bulto',
  capacidad_vehiculo_kg: 'Capacidad veh. (kg)',
  factor_km: 'Factor km override',
  distribuidor_nombre: 'Distribuidor (nombre)',
  patente_match: 'Patente match',
  activo: 'Activo',
  aprobado_por: 'Aprobado por',
};

const fmtVal = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
};

const parseMoneyInput = (raw: string): number | null => {
  let s = (raw ?? '').trim();
  if (s === '') return null;
  s = s.replace(/[^0-9,.\-]/g, '');
  if (s === '' || s === '-' || s === '.' || s === ',') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decLen = s.length - lastComma - 1;
    if (decLen >= 1 && decLen <= 2) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
};

export function LineaTarifaEditModal({ api, linea, dimensiones, isOcasa, onClose, onSaved, formatDate }: Props) {
  const fmtDate = formatDate ?? ((s: string) => s);
  // Tabs
  const [view, setView] = useState<'edit' | 'hist'>('edit');

  // Editable básicos
  const [precioOriginal, setPrecioOriginal] = useState<string>(linea.precio_original ?? '');
  const [pctAgencia, setPctAgencia] = useState<string>(linea.porcentaje_agencia ?? '');
  const [precioDistribuidor, setPrecioDistribuidor] = useState<string>(linea.precio_distribuidor ?? '');
  const [autoDistrib, setAutoDistrib] = useState<boolean>(true);
  const [vigDesde, setVigDesde] = useState<string>((linea.vigencia_desde ?? '').slice(0, 10));
  const [vigHasta, setVigHasta] = useState<string>((linea.vigencia_hasta ?? '').slice(0, 10) || '');

  // OCASA
  const [modeloTarifa, setModeloTarifa] = useState<string>(linea.modelo_tarifa ?? 'JORNADA');
  const [costoFijoBase, setCostoFijoBase] = useState<string>(linea.costo_fijo_base ?? '');
  const [tarifaKmOriginal, setTarifaKmOriginal] = useState<string>(linea.tarifa_km_original ?? '');
  const [tarifaKmDistribuidor, setTarifaKmDistribuidor] = useState<string>(linea.tarifa_km_distribuidor ?? '');
  const [umbralKm, setUmbralKm] = useState<string>(linea.umbral_km != null ? String(linea.umbral_km) : '240');
  const [modoProd, setModoProd] = useState<string>(linea.modo_productividad ?? 'por_parada');
  const [tarifaParada, setTarifaParada] = useState<string>(linea.tarifa_parada_distrib ?? '');
  const [tarifaBulto, setTarifaBulto] = useState<string>(linea.tarifa_bulto_distrib ?? '');
  const [capacidadKg, setCapacidadKg] = useState<string>(linea.capacidad_vehiculo_kg != null ? String(linea.capacidad_vehiculo_kg) : '');

  // Overrides
  const [factorKm, setFactorKm] = useState<string>(linea.factor_km ?? '');
  const [distribuidorNombre, setDistribuidorNombre] = useState<string>(linea.distribuidor_nombre ?? '');
  const [patenteMatch, setPatenteMatch] = useState<string>(linea.patente_match ?? '');

  // Motivo y submit
  const [motivo, setMotivo] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Historial
  const [historial, setHistorial] = useState<HistorialEntry[] | null>(null);
  const [historialLoading, setHistorialLoading] = useState<boolean>(false);

  // Auto recálculo de precio_distribuidor
  useEffect(() => {
    if (!autoDistrib) return;
    const po = parseMoneyInput(precioOriginal);
    const pa = parseMoneyInput(pctAgencia);
    if (po == null || pa == null) return;
    const nuevo = Math.round(po * (1 - pa / 100) * 100) / 100;
    setPrecioDistribuidor(String(nuevo));
  }, [autoDistrib, precioOriginal, pctAgencia]);

  const cargarHistorial = useCallback(async () => {
    setHistorialLoading(true);
    try {
      const res = await api.get(`/lineas/${linea.id}/historial`);
      setHistorial(res.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando histórico');
    } finally {
      setHistorialLoading(false);
    }
  }, [api, linea.id]);

  useEffect(() => {
    if (view === 'hist' && historial === null) void cargarHistorial();
  }, [view, historial, cargarHistorial]);

  const submit = useCallback(async () => {
    if (motivo.trim().length < 5) { setError('Motivo requiere mínimo 5 caracteres'); return; }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { motivo: motivo.trim() };
      const po = parseMoneyInput(precioOriginal);
      const pa = parseMoneyInput(pctAgencia);
      const pd = parseMoneyInput(precioDistribuidor);
      if (po != null) body.precio_original = po;
      if (pa != null) body.porcentaje_agencia = pa;
      if (pd != null) body.precio_distribuidor = pd;
      if (vigDesde) body.vigencia_desde = vigDesde;
      body.vigencia_hasta = vigHasta || null;
      if (isOcasa) {
        body.modelo_tarifa = modeloTarifa || null;
        const cfb = parseMoneyInput(costoFijoBase);
        body.costo_fijo_base = cfb;
        if (modeloTarifa === 'JORNADA_KM') {
          body.tarifa_km_original = parseMoneyInput(tarifaKmOriginal);
          body.tarifa_km_distribuidor = parseMoneyInput(tarifaKmDistribuidor);
          body.umbral_km = parseInt(umbralKm, 10) || 240;
        }
        if (modeloTarifa === 'PRODUCTIVIDAD') {
          body.modo_productividad = modoProd;
          body.tarifa_parada_distrib = modoProd === 'por_parada' ? parseMoneyInput(tarifaParada) : null;
          body.tarifa_bulto_distrib = modoProd === 'por_bulto' ? parseMoneyInput(tarifaBulto) : null;
        }
        body.capacidad_vehiculo_kg = capacidadKg ? parseInt(capacidadKg, 10) : null;
      }
      // Overrides (string vacío => limpiar override)
      body.factor_km = factorKm.trim() === '' ? '' : (parseMoneyInput(factorKm) ?? '');
      body.distribuidor_nombre = distribuidorNombre.trim() === '' ? '' : distribuidorNombre.trim();
      body.patente_match = patenteMatch.trim() === '' ? '' : patenteMatch.trim().toUpperCase();
      await api.put(`/lineas/${linea.id}`, body);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  }, [api, linea.id, motivo, precioOriginal, pctAgencia, precioDistribuidor, vigDesde, vigHasta, isOcasa, modeloTarifa, costoFijoBase, tarifaKmOriginal, tarifaKmDistribuidor, umbralKm, modoProd, tarifaParada, tarifaBulto, capacidadKg, factorKm, distribuidorNombre, patenteMatch, onSaved]);

  const ruta = useMemo(() => dimensiones.map((d) => `${d}: ${linea.dimensiones_valores[d] ?? '—'}`).join(' / '), [dimensiones, linea.dimensiones_valores]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 8, maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Editar línea de tarifa</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{ruta}</div>
          </div>
          <button type="button" className="btn-sm" onClick={onClose}>Cerrar</button>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className={view === 'edit' ? 'btn-sm btn-primary' : 'btn-sm'} onClick={() => setView('edit')}>Editar</button>
          <button type="button" className={view === 'hist' ? 'btn-sm btn-primary' : 'btn-sm'} onClick={() => setView('hist')}>Ver histórico</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>
        )}

        {view === 'edit' && (
          <>
            <section style={{ marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Precios</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Precio original</label>
                  <input className="form-input" inputMode="decimal" value={precioOriginal} onChange={(e) => setPrecioOriginal(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>% Agencia</label>
                  <input className="form-input" inputMode="decimal" value={pctAgencia} onChange={(e) => setPctAgencia(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    <input type="checkbox" checked={autoDistrib} onChange={(e) => setAutoDistrib(e.target.checked)} style={{ marginRight: 6 }} />
                    Precio distribuidor {autoDistrib && <span style={{ color: '#6b7280', fontSize: 11 }}>(auto)</span>}
                  </label>
                  <input
                    className="form-input"
                    inputMode="decimal"
                    value={precioDistribuidor}
                    onChange={(e) => setPrecioDistribuidor(e.target.value)}
                    readOnly={autoDistrib}
                    style={autoDistrib ? { background: '#f3f4f6', color: '#374151' } : {}}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia desde</label>
                  <input type="date" className="form-input" value={vigDesde} onChange={(e) => setVigDesde(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vigencia hasta</label>
                  <input type="date" className="form-input" value={vigHasta} onChange={(e) => setVigHasta(e.target.value)} />
                </div>
              </div>
            </section>

            {isOcasa && (
              <section style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px dashed #d1d5db' }}>
                <h4 style={{ marginTop: 0 }}>OCASA</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Modelo tarifa</label>
                    <select className="form-input" value={modeloTarifa} onChange={(e) => setModeloTarifa(e.target.value)}>
                      <option value="JORNADA">Jornada</option>
                      <option value="JORNADA_KM">Jornada + KM</option>
                      <option value="PRODUCTIVIDAD">Productividad</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Costo fijo base</label>
                    <input className="form-input" inputMode="decimal" value={costoFijoBase} onChange={(e) => setCostoFijoBase(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Capacidad veh. (kg)</label>
                    <select className="form-input" value={capacidadKg} onChange={(e) => setCapacidadKg(e.target.value)}>
                      <option value="">Sin especificar</option>
                      <option value="100">100 (Moto)</option>
                      <option value="700">700 (Furgón chico)</option>
                      <option value="2500">2500 (Utilitario)</option>
                      <option value="5000">5000 (Camión liviano)</option>
                      <option value="10000">10000 (Camión)</option>
                    </select>
                  </div>
                  {modeloTarifa === 'JORNADA_KM' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$/km original</label>
                        <input className="form-input" inputMode="decimal" value={tarifaKmOriginal} onChange={(e) => setTarifaKmOriginal(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$/km distribuidor</label>
                        <input className="form-input" inputMode="decimal" value={tarifaKmDistribuidor} onChange={(e) => setTarifaKmDistribuidor(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Umbral km</label>
                        <input className="form-input" inputMode="decimal" value={umbralKm} onChange={(e) => setUmbralKm(e.target.value)} />
                      </div>
                    </>
                  )}
                  {modeloTarifa === 'PRODUCTIVIDAD' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Modo</label>
                        <select className="form-input" value={modoProd} onChange={(e) => setModoProd(e.target.value)}>
                          <option value="por_parada">Por parada</option>
                          <option value="por_bulto">Por bulto</option>
                          <option value="porcentaje">Porcentaje</option>
                        </select>
                      </div>
                      {modoProd === 'por_parada' && (
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$ por parada</label>
                          <input className="form-input" inputMode="decimal" value={tarifaParada} onChange={(e) => setTarifaParada(e.target.value)} />
                        </div>
                      )}
                      {modoProd === 'por_bulto' && (
                        <div>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>$ por bulto</label>
                          <input className="form-input" inputMode="decimal" value={tarifaBulto} onChange={(e) => setTarifaBulto(e.target.value)} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            <section style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px dashed #d1d5db' }}>
              <h4 style={{ marginTop: 0 }}>Override manual <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>(dejar vacío para limpiar)</span></h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Factor km override</label>
                  <input className="form-input" inputMode="decimal" value={factorKm} onChange={(e) => setFactorKm(e.target.value)} placeholder="Ej: 0.8147" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Distribuidor (nombre)</label>
                  <input className="form-input" value={distribuidorNombre} onChange={(e) => setDistribuidorNombre(e.target.value)} placeholder="Ej: Walter Pérez" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Patente match</label>
                  <input className="form-input" value={patenteMatch} onChange={(e) => setPatenteMatch(e.target.value)} placeholder="Ej: PSS206" />
                </div>
              </div>
            </section>

            <section style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Motivo del cambio (mín 5 caracteres) *</label>
              <textarea
                className="form-input"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Walter PSS206 PAL831 acordaron factor 0.8147"
              />
            </section>

            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <button type="button" className="btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={submit} disabled={saving || motivo.trim().length < 5}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </footer>
          </>
        )}

        {view === 'hist' && (
          <section>
            {historialLoading && <div style={{ color: '#6b7280' }}>Cargando histórico…</div>}
            {!historialLoading && historial && historial.length === 0 && (
              <div style={{ color: '#6b7280' }}>Sin movimientos registrados.</div>
            )}
            {!historialLoading && historial && historial.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historial.map((h) => (
                  <div key={h.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <strong>{h.accion}</strong>
                        {h.usuario && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>{h.usuario.name}</span>}
                      </div>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>{fmtDate(h.created_at)}</span>
                    </div>
                    {h.motivo && <div style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 6 }}>{h.motivo}</div>}
                    {Object.keys(h.campos_modificados).length > 0 ? (
                      <table style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr><th style={{ textAlign: 'left' }}>Campo</th><th style={{ textAlign: 'left' }}>Antes</th><th style={{ textAlign: 'left' }}>Después</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(h.campos_modificados).map(([k, v]) => (
                            <tr key={k}>
                              <td>{FIELD_LABELS[k] ?? k}</td>
                              <td style={{ color: '#991b1b' }}>{fmtVal(v.antes)}</td>
                              <td style={{ color: '#15803d' }}>{fmtVal(v.despues)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>(Sin cambios detectados en campos)</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #e5e7eb', marginTop: 12 }}>
              <button type="button" className="btn-sm" onClick={onClose}>Cerrar</button>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
}

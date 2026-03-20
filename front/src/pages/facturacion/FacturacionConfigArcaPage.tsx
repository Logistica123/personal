import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArcaCertificadoDto, ArcaEmisorDto } from '../../features/facturacion/types';
import {
  FACTURACION_DEFAULT_AMBIENTE,
  FACTURACION_DEFAULT_CERT_ALIAS,
  FACTURACION_EMISOR_CONDICION_IVA,
  FACTURACION_EMISOR_CUIT,
  FACTURACION_EMISOR_RAZON_SOCIAL,
} from '../../features/facturacion/constants';
import { formatDateOnly } from '../../features/facturacion/utils';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionConfigArcaPage = (ctx: FacturacionPageContext) => {
  const { FacturacionShell, useFacturacionApi, buildDownloadUrl, formatDateTime } = ctx;

  const FacturacionConfigArcaPage: React.FC = () => {
    const { requestJson, apiBaseUrl } = useFacturacionApi();
    const [emisores, setEmisores] = useState<ArcaEmisorDto[]>([]);
    const [selectedEmisorId, setSelectedEmisorId] = useState<string>('');
    const [emisorForm, setEmisorForm] = useState({
      razon_social: FACTURACION_EMISOR_RAZON_SOCIAL,
      cuit: FACTURACION_EMISOR_CUIT,
      condicion_iva: FACTURACION_EMISOR_CONDICION_IVA,
      ambiente_default: FACTURACION_DEFAULT_AMBIENTE as 'HOMO' | 'PROD',
      activo: true,
    });
    const [csrAlias, setCsrAlias] = useState(FACTURACION_DEFAULT_CERT_ALIAS);
    const [csrCommonName, setCsrCommonName] = useState(FACTURACION_DEFAULT_CERT_ALIAS);
    const [csrOrganization, setCsrOrganization] = useState(FACTURACION_EMISOR_RAZON_SOCIAL);
    const [csrCountry] = useState('AR');
    const [csrAmbiente, setCsrAmbiente] = useState<'HOMO' | 'PROD'>(FACTURACION_DEFAULT_AMBIENTE);
    const [csrData, setCsrData] = useState<{
      id: number;
      alias: string;
      csr_pem: string;
      download_url: string;
    } | null>(null);
    const [importCertId, setImportCertId] = useState<string>('');
    const [importType, setImportType] = useState<'crt' | 'crt_key' | 'p12'>('p12');
    const [importPassword, setImportPassword] = useState('');
    const [importActivo, setImportActivo] = useState(true);
    const [importCrtFile, setImportCrtFile] = useState<File | null>(null);
    const [importKeyFile, setImportKeyFile] = useState<File | null>(null);
    const [importP12File, setImportP12File] = useState<File | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const refreshEmisores = useCallback(async () => {
      const payload = (await requestJson('/api/arca/emisores?with_relations=1')) as { data?: ArcaEmisorDto[] };
      setEmisores(Array.isArray(payload?.data) ? payload.data : []);
    }, [requestJson]);

    useEffect(() => {
      void refreshEmisores();
    }, [refreshEmisores]);

    useEffect(() => {
      const emisor = emisores.find((item) => item.id === Number(selectedEmisorId));
      if (emisor) {
        setEmisorForm({
          razon_social: emisor.razon_social ?? '',
          cuit: emisor.cuit ?? '',
          condicion_iva: emisor.condicion_iva ?? '',
          ambiente_default: emisor.ambiente_default ?? 'PROD',
          activo: emisor.activo,
        });
        setCsrOrganization(emisor.razon_social ?? '');
      }
    }, [emisores, selectedEmisorId]);

    const csrAliasRef = useRef(csrAlias);

    useEffect(() => {
      setCsrCommonName((prev) => (prev.trim() === '' || prev === csrAliasRef.current ? csrAlias : prev));
      csrAliasRef.current = csrAlias;
    }, [csrAlias]);

    const selectedEmisor = useMemo(
      () => emisores.find((item) => item.id === Number(selectedEmisorId)) ?? null,
      [emisores, selectedEmisorId]
    );

    useEffect(() => {
      if (selectedEmisor?.certificados && selectedEmisor.certificados.length > 0 && !importCertId) {
        setImportCertId(String(selectedEmisor.certificados[0].id));
      }
    }, [importCertId, selectedEmisor]);

    const handleSaveEmisor = async () => {
      try {
        setFeedback(null);
        const payload = {
          razon_social: emisorForm.razon_social,
          cuit: emisorForm.cuit,
          condicion_iva: emisorForm.condicion_iva,
          ambiente_default: emisorForm.ambiente_default,
          activo: emisorForm.activo,
        };
        if (selectedEmisor) {
          await requestJson(`/api/arca/emisores/${selectedEmisor.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await requestJson('/api/arca/emisores', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        await refreshEmisores();
        setFeedback({ type: 'success', message: 'Emisor guardado correctamente.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudo guardar el emisor.' });
      }
    };

    const handleGenerateCsr = async () => {
      if (!selectedEmisor) {
        setFeedback({ type: 'error', message: 'Seleccioná un emisor.' });
        return;
      }
      try {
        setFeedback(null);
        const payload = {
          emisor_id: selectedEmisor.id,
          alias: csrAlias,
          common_name: csrCommonName,
          organization: csrOrganization,
          country: csrCountry,
          ambiente: csrAmbiente,
        };
        const response = (await requestJson('/api/arca/certificados/generar-csr', {
          method: 'POST',
          body: JSON.stringify(payload),
        })) as {
          certificado_borrador_id: number;
          alias: string;
          csr_pem: string;
          download_url: string;
        };
        setCsrData({
          id: response.certificado_borrador_id,
          alias: response.alias,
          csr_pem: response.csr_pem,
          download_url: response.download_url,
        });
        setImportCertId(String(response.certificado_borrador_id));
        await refreshEmisores();
        setFeedback({ type: 'success', message: 'CSR generado correctamente.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudo generar el CSR.' });
      }
    };

    const handleDownloadCsr = (certId?: number, downloadUrl?: string | null) => {
      const targetUrl = downloadUrl ?? (certId ? `/api/arca/certificados/${certId}/csr` : null);
      if (!targetUrl) {
        setFeedback({ type: 'error', message: 'No hay CSR disponible para descargar.' });
        return;
      }
      const resolved = buildDownloadUrl(apiBaseUrl, targetUrl);
      if (!resolved) {
        setFeedback({ type: 'error', message: 'No se pudo construir la URL de descarga.' });
        return;
      }
      window.open(resolved, '_blank', 'noopener');
    };

    const handleImportCert = async () => {
      if (!selectedEmisor) {
        setFeedback({ type: 'error', message: 'Seleccioná un emisor.' });
        return;
      }
      if (!importCertId) {
        setFeedback({ type: 'error', message: 'Seleccioná el certificado borrador a completar.' });
        return;
      }
      const certificado = selectedEmisor.certificados?.find((item) => item.id === Number(importCertId));
      if (!certificado) {
        setFeedback({ type: 'error', message: 'Certificado inválido.' });
        return;
      }
      try {
        const formData = new FormData();
        formData.append('alias', certificado.alias);
        formData.append('ambiente', certificado.ambiente);
        formData.append('activo', importActivo ? '1' : '0');
        if (importType === 'p12') {
          if (!importP12File) {
            setFeedback({ type: 'error', message: 'Seleccioná un archivo P12.' });
            return;
          }
          formData.append('p12', importP12File);
          formData.append('password', importPassword);
        } else {
          if (!importCrtFile) {
            setFeedback({ type: 'error', message: 'Seleccioná el archivo CRT.' });
            return;
          }
          formData.append('crt', importCrtFile);
          if (importType === 'crt_key') {
            if (!importKeyFile) {
              setFeedback({ type: 'error', message: 'Seleccioná el archivo KEY.' });
              return;
            }
            formData.append('key', importKeyFile);
          }
          if (importPassword) {
            formData.append('password', importPassword);
          }
        }
        await requestJson(`/api/arca/certificados/${certificado.id}/importar`, {
          method: 'POST',
          body: formData,
        });
        await refreshEmisores();
        setFeedback({ type: 'success', message: 'Certificado importado correctamente.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudo importar el certificado.' });
      }
    };

    const handleTestWsaa = async () => {
      if (!selectedEmisor || !importCertId) {
        setFeedback({ type: 'error', message: 'Seleccioná un certificado para probar WSAA.' });
        return;
      }
      try {
        await requestJson(`/api/arca/certificados/${importCertId}/test-wsaa`, { method: 'POST' });
        setFeedback({ type: 'success', message: 'WSAA OK.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'Error al testear WSAA.' });
      }
    };

    const handleSyncPuntosVenta = async () => {
      if (!selectedEmisor) {
        return;
      }
      try {
        const certAmbiente =
          selectedEmisor.certificados?.find((item) => item.id === Number(importCertId))?.ambiente ?? csrAmbiente;
        await requestJson(`/api/arca/emisores/${selectedEmisor.id}/puntos-venta/sincronizar`, {
          method: 'POST',
          body: JSON.stringify({ ambiente: certAmbiente }),
        });
        await refreshEmisores();
        setFeedback({ type: 'success', message: 'Puntos de venta sincronizados.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudieron sincronizar puntos.' });
      }
    };

    const handleToggleCert = async (certificado: ArcaCertificadoDto, activar: boolean) => {
      try {
        await requestJson(`/api/arca/certificados/${certificado.id}/${activar ? 'activar' : 'desactivar'}`, { method: 'POST' });
        await refreshEmisores();
        setFeedback({ type: 'success', message: activar ? 'Certificado activado.' : 'Certificado desactivado.' });
      } catch (err) {
        setFeedback({ type: 'error', message: (err as Error).message ?? 'No se pudo actualizar el certificado.' });
      }
    };

    return (
      <FacturacionShell title="Configuración ARCA" subtitle="Emisores, certificados y puntos de venta">
        {feedback ? (
          <p className={`form-info ${feedback.type === 'error' ? 'form-info--error' : 'form-info--success'}`}>
            {feedback.message}
          </p>
        ) : null}
        <section className="dashboard-card facturacion-section">
          <h3>Emisores</h3>
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Seleccionar emisor</span>
              <select value={selectedEmisorId} onChange={(event) => setSelectedEmisorId(event.target.value)}>
                <option value="">Nuevo emisor</option>
                {emisores.map((emisor) => (
                  <option key={emisor.id} value={emisor.id}>
                    {emisor.razon_social}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Razón social</span>
              <input value={emisorForm.razon_social} disabled />
            </label>
            <label className="input-control">
              <span>CUIT</span>
              <input value={emisorForm.cuit} disabled />
            </label>
            <label className="input-control">
              <span>Condición IVA</span>
              <input value={emisorForm.condicion_iva} disabled />
            </label>
            <label className="input-control">
              <span>Ambiente</span>
              <select
                value={emisorForm.ambiente_default}
                disabled
              >
                <option value="PROD">PROD</option>
              </select>
            </label>
            <label className="input-control facturacion-toggle">
              <span>Activo</span>
              <input
                type="checkbox"
                checked={emisorForm.activo}
                onChange={(event) => setEmisorForm((prev) => ({ ...prev, activo: event.target.checked }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleSaveEmisor}>
              Guardar emisor
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setSelectedEmisorId('');
                setEmisorForm({
                  razon_social: FACTURACION_EMISOR_RAZON_SOCIAL,
                  cuit: FACTURACION_EMISOR_CUIT,
                  condicion_iva: FACTURACION_EMISOR_CONDICION_IVA,
                  ambiente_default: FACTURACION_DEFAULT_AMBIENTE,
                  activo: true,
                });
              }}
            >
              Nuevo emisor
            </button>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Generar CSR</h3>
          <p className="form-hint">
            El CSR se genera en el ERP y se sube en ARCA. La clave privada queda resguardada en el servidor.
          </p>
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Emisor</span>
              <input value={selectedEmisor?.razon_social ?? ''} disabled />
            </label>
            <label className="input-control">
              <span>CUIT</span>
              <input value={selectedEmisor?.cuit ?? ''} disabled />
            </label>
            <label className="input-control">
              <span>Alias</span>
              <input value={csrAlias} onChange={(event) => setCsrAlias(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Common Name (CN)</span>
              <input value={csrCommonName} onChange={(event) => setCsrCommonName(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Organization (O)</span>
              <input value={csrOrganization} onChange={(event) => setCsrOrganization(event.target.value)} />
            </label>
            <label className="input-control">
              <span>Country (C)</span>
              <input value={csrCountry} disabled />
            </label>
            <label className="input-control">
              <span>Ambiente</span>
              <select value={csrAmbiente} onChange={(event) => setCsrAmbiente(event.target.value as 'HOMO' | 'PROD')}>
                <option value="PROD">PROD</option>
                <option value="HOMO">HOMO</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleGenerateCsr} disabled={!selectedEmisor}>
              Generar CSR
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => handleDownloadCsr(csrData?.id, csrData?.download_url)}
              disabled={!csrData?.download_url}
            >
              Descargar CSR
            </button>
          </div>
          {csrData?.csr_pem ? (
            <div className="input-control">
              <span>CSR generado</span>
              <textarea value={csrData.csr_pem} readOnly rows={6} />
            </div>
          ) : null}

          <div className="facturacion-divider" />

          <h3>Importar certificado emitido</h3>
          <p className="form-hint">
            Subí el CRT o P12 emitido por ARCA. El CSR no se carga acá.
          </p>
          <div className="filters-grid facturacion-grid">
            <label className="input-control">
              <span>Certificado</span>
              <select value={importCertId} onChange={(event) => setImportCertId(event.target.value)}>
                <option value="">Seleccionar</option>
                {(selectedEmisor?.certificados ?? []).map((cert) => (
                  <option key={cert.id} value={cert.id}>
                    {cert.alias} ({cert.ambiente}) {cert.estado ? `- ${cert.estado}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Tipo importación</span>
              <select value={importType} onChange={(event) => setImportType(event.target.value as 'crt' | 'crt_key' | 'p12')}>
                <option value="p12">P12/PFX</option>
                <option value="crt">CRT (usa clave del servidor)</option>
                <option value="crt_key">CRT + KEY</option>
              </select>
            </label>
            <label className="input-control">
              <span>Password</span>
              <input value={importPassword} onChange={(event) => setImportPassword(event.target.value)} type="password" />
            </label>
            <label className="input-control facturacion-toggle">
              <span>Activo</span>
              <input type="checkbox" checked={importActivo} onChange={(event) => setImportActivo(event.target.checked)} />
            </label>
          </div>
          <div className="filters-grid facturacion-grid">
            {importType === 'p12' ? (
              <label className="input-control">
                <span>Archivo P12</span>
                <input type="file" accept=".p12,.pfx" onChange={(event) => setImportP12File(event.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <>
                <label className="input-control">
                  <span>Archivo CRT</span>
                  <input type="file" accept=".crt,.pem" onChange={(event) => setImportCrtFile(event.target.files?.[0] ?? null)} />
                </label>
                {importType === 'crt_key' ? (
                  <label className="input-control">
                    <span>Archivo KEY</span>
                    <input type="file" accept=".key,.pem" onChange={(event) => setImportKeyFile(event.target.files?.[0] ?? null)} />
                  </label>
                ) : null}
              </>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleImportCert} disabled={!selectedEmisor}>
              Importar certificado
            </button>
            <button type="button" className="secondary-action" onClick={handleTestWsaa} disabled={!selectedEmisor || !importCertId}>
              Test WSAA
            </button>
          </div>

          <div className="facturacion-divider" />

          <h3>Guía rápida</h3>
          <ol className="facturacion-steps">
            <li>Generar CSR en el ERP.</li>
            <li>Descargar el archivo .csr.</li>
            <li>Subir el CSR en ARCA / Administración de Certificados Digitales.</li>
            <li>Descargar el certificado .crt emitido por ARCA.</li>
            <li>Asociar el certificado al WSN en Administrador de Relaciones de Clave Fiscal.</li>
            <li>Importar el .crt o .p12 en el ERP.</li>
            <li>Probar WSAA.</li>
          </ol>

          <div className="facturacion-divider" />

          <h3>Certificados cargados</h3>
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Ambiente</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th>Activo</th>
                  <th>Último login</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(selectedEmisor?.certificados ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7}>Sin certificados cargados.</td>
                  </tr>
                ) : (
                  (selectedEmisor?.certificados ?? []).map((cert) => (
                    <tr key={cert.id}>
                      <td>{cert.alias}</td>
                      <td>{cert.ambiente}</td>
                      <td>{cert.estado ?? '—'}</td>
                      <td>
                        {formatDateOnly(cert.valid_from)} → {formatDateOnly(cert.valid_to)}
                      </td>
                      <td>{cert.activo ? 'Sí' : 'No'}</td>
                      <td>{formatDateTime(cert.ultimo_login_wsaa_ok_at ?? '')}</td>
                      <td className="actions-cell">
                        {cert.has_csr ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => handleDownloadCsr(cert.id)}
                          >
                            Descargar CSR
                          </button>
                        ) : null}
                        {cert.activo ? (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => handleToggleCert(cert, false)}
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-action secondary-action--ghost"
                            onClick={() => handleToggleCert(cert, true)}
                          >
                            Activar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-card facturacion-section">
          <h3>Puntos de venta</h3>
          <div className="form-actions">
            <button type="button" className="primary-action" onClick={handleSyncPuntosVenta} disabled={!selectedEmisor}>
              Sincronizar
            </button>
          </div>
          <div className="table-wrapper facturacion-table">
            <table>
              <thead>
                <tr>
                  <th>Nro</th>
                  <th>Ambiente</th>
                  <th>Sistema</th>
                  <th>Bloqueado</th>
                  <th>ERP</th>
                </tr>
              </thead>
              <tbody>
                {(selectedEmisor?.puntos_venta ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin puntos de venta sincronizados.</td>
                  </tr>
                ) : (
                  (selectedEmisor?.puntos_venta ?? []).map((punto) => (
                    <tr key={punto.id}>
                      <td>{String(punto.nro).padStart(4, '0')}</td>
                      <td>{punto.ambiente}</td>
                      <td>{punto.sistema_arca ?? punto.emision_tipo ?? '—'}</td>
                      <td>{punto.bloqueado ? 'Sí' : 'No'}</td>
                      <td>{punto.habilitado_para_erp ? 'Sí' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </FacturacionShell>
    );
  };

  return FacturacionConfigArcaPage;
};

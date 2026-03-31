import React, { useMemo, useState } from 'react';
import { ConfiguracionTab } from '../features/liquidaciones/ConfiguracionTab';
import { DistribuidoresTab } from '../features/liquidaciones/DistribuidoresTab';
import { ExtractosTab } from '../features/liquidaciones/ExtractosTab';
import { PagosTab } from '../features/liquidaciones/PagosTab';
import { TarifasTab } from '../features/liquidaciones/TarifasTab';

// ─── Tipos de props (igual al patrón de la app) ─────────────────────────────

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
};

type Props = {
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null | undefined) => Record<string, string>;
};

// ─── Definición de tabs ──────────────────────────────────────────────────────

type TabId = 'extractos' | 'distribuidores' | 'pagos' | 'tarifas' | 'configuracion';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'extractos', label: 'Extractos', icon: '📥' },
  { id: 'distribuidores', label: 'Distribuidores', icon: '👤' },
  { id: 'pagos', label: 'Pagos', icon: '💸' },
  { id: 'tarifas', label: 'Tarifas', icon: '📋' },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
];

// ─── Componente principal ────────────────────────────────────────────────────

export const LiquidacionesExtractosPage: React.FC<Props> = ({
  DashboardLayout,
  resolveApiBaseUrl,
  useStoredAuthUser,
  buildActorHeaders,
}) => {
  const [tabActivo, setTabActivo] = useState<TabId>('extractos');
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [authUser, buildActorHeaders]);
  const stableHeaders = useMemo<() => Record<string, string>>(
    () => () => actorHeaders,
    [actorHeaders],
  );

  const navContent = (
    <div style={navStyle}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          style={{
            ...tabBtnBase,
            ...(tabActivo === tab.id ? tabBtnActive : tabBtnInactive),
          }}
          onClick={() => setTabActivo(tab.id)}
        >
          <span style={{ marginRight: 6 }}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <DashboardLayout
      title="Control de Liquidaciones"
      subtitle="Módulo v2.0 — Multi-cliente · Tarifas flexibles · Generación de pagos"
      headerContent={navContent}
    >
      <div style={contentStyle}>
        {tabActivo === 'extractos' && (
          <ExtractosTab apiBaseUrl={apiBaseUrl} buildActorHeaders={stableHeaders} />
        )}
        {tabActivo === 'distribuidores' && (
          <DistribuidoresTab apiBaseUrl={apiBaseUrl} buildActorHeaders={stableHeaders} />
        )}
        {tabActivo === 'pagos' && (
          <PagosTab apiBaseUrl={apiBaseUrl} buildActorHeaders={stableHeaders} />
        )}
        {tabActivo === 'tarifas' && (
          <TarifasTab apiBaseUrl={apiBaseUrl} buildActorHeaders={stableHeaders} />
        )}
        {tabActivo === 'configuracion' && (
          <ConfiguracionTab apiBaseUrl={apiBaseUrl} buildActorHeaders={stableHeaders} />
        )}
      </div>
    </DashboardLayout>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  paddingBottom: 0,
};

const tabBtnBase: React.CSSProperties = {
  padding: '7px 18px',
  border: 'none',
  borderRadius: '6px 6px 0 0',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  transition: 'background 0.15s',
  display: 'flex',
  alignItems: 'center',
};

const tabBtnActive: React.CSSProperties = {
  background: '#fff',
  color: '#1d4ed8',
  fontWeight: 700,
  boxShadow: '0 -1px 0 0 #e5e7eb inset',
};

const tabBtnInactive: React.CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
};

const contentStyle: React.CSSProperties = {
  padding: '24px',
  maxWidth: 1400,
};

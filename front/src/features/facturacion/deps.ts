import type React from 'react';

export type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

export type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  token?: string | null;
  permissions?: string[] | null;
};

export type FacturacionDeps = {
  DashboardLayout: React.FC<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  buildActorHeaders: (authUser: AuthUser | null) => Record<string, string>;
  resolveApiUrl: (baseUrl: string, target?: string | null) => string | null;
  withAuthToken: (url: string | null) => string | null;
  parseJsonSafe: (response: Response) => Promise<any>;
  formatCurrency: (value: number) => string;
  formatDateTime: (value: string | null | undefined) => string;
};


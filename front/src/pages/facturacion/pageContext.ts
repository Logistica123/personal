import type React from 'react';

export type FacturacionShellComponent = React.FC<{
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}>;

export type FacturacionApiClient = {
  apiBaseUrl: string;
  actorHeaders: Record<string, string>;
  requestJson: (path: string, options?: RequestInit) => Promise<any>;
  requestText: (path: string, options?: RequestInit) => Promise<string>;
};

export type FacturacionPageContext = {
  FacturacionShell: FacturacionShellComponent;
  useFacturacionApi: () => FacturacionApiClient;
  buildDownloadUrl: (apiBaseUrl: string, path: string | null | undefined) => string | null;
  formatCurrency: (value: number) => string;
  formatDateTime: (value: string | null | undefined) => string;
};


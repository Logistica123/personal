import type { FacturacionDeps } from '../../features/facturacion/deps';
import { buildDownloadUrl, useFacturacionApi } from '../../features/facturacion/api';
import type { FacturacionPageContext } from './pageContext';
import { createFacturacionShell } from './FacturacionShell';
import { createFacturacionClientesGrupoPage } from './FacturacionClientesGrupoPage';
import { createFacturacionClientesPage } from './FacturacionClientesPage';
import { createFacturacionConfigArcaPage } from './FacturacionConfigArcaPage';
import { createFacturacionCreatePage } from './FacturacionCreatePage';
import { createFacturacionDetailPage } from './FacturacionDetailPage';
import { createFacturacionListadoPage } from './FacturacionListadoPage';
import { createFacturacionPage } from './FacturacionPage';

export type { FacturacionDeps };

export const createFacturacionPages = (deps: FacturacionDeps) => {
  const FacturacionShell = createFacturacionShell(deps.DashboardLayout);

  const ctx: FacturacionPageContext = {
    FacturacionShell,
    useFacturacionApi: () => useFacturacionApi(deps),
    buildDownloadUrl: (apiBaseUrl, path) => buildDownloadUrl(deps, apiBaseUrl, path),
    formatCurrency: deps.formatCurrency,
    formatDateTime: deps.formatDateTime,
  };

  const FacturacionPage = createFacturacionPage(ctx);
  const FacturacionListadoPage = createFacturacionListadoPage(ctx);
  const FacturacionCreatePage = createFacturacionCreatePage(ctx);
  const FacturacionDetailPage = createFacturacionDetailPage(ctx);
  const FacturacionClientesPage = createFacturacionClientesPage(ctx);
  const FacturacionClientesGrupoPage = createFacturacionClientesGrupoPage(ctx);
  const FacturacionConfigArcaPage = createFacturacionConfigArcaPage(ctx);

  return {
    FacturacionPage,
    FacturacionListadoPage,
    FacturacionCreatePage,
    FacturacionDetailPage,
    FacturacionClientesPage,
    FacturacionClientesGrupoPage,
    FacturacionConfigArcaPage,
  };
};


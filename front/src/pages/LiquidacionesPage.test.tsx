import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LiquidacionesPage } from './LiquidacionesPage';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

const buildJsonResponse = (body: unknown, init?: { ok?: boolean; status?: number }) => {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response;
};

describe('LiquidacionesPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('Nueva liquidación resetea importe y limpia el descuento mostrado', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');

      if (url.includes('/api/personal?includePending=1')) {
        return buildJsonResponse({
          data: [
            {
              id: 1,
              apellidos: 'Test',
              nombres: 'User',
              aprobado: true,
              patente: 'AH066DM',
              cliente: 'CLIENTE-ACME',
              liquidacionImporteFacturar: 2000000,
              combustibleResumen: { totalToBill: 45000 },
              documents: [],
            },
          ],
        });
      }

      if (url.includes('/api/personal/documentos/tipos')) {
        return buildJsonResponse({
          data: [{ id: 10, nombre: 'Liquidación', vence: false }],
        });
      }

      if (url.includes('/api/personal/1?includePending=1')) {
        return buildJsonResponse({
          data: {
            id: 1,
            apellidos: 'Test',
            nombres: 'User',
            patente: 'AH066DM',
            documents: [],
          },
        });
      }

      return buildJsonResponse({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={['/liquidaciones/1']}>
        <Routes>
          <Route
            path="/liquidaciones/:personaId"
            element={
              <LiquidacionesPage
                DashboardLayout={DashboardLayout as any}
                resolveApiBaseUrl={() => ''}
                useStoredAuthUser={() => null}
                buildActorHeaders={() => null}
                resolveApiUrl={() => null}
                parseJsonSafe={async (response) => (response as any).json()}
                formatCurrency={(value) => String(value ?? '')}
                formatPagoLabel={() => ''}
                getPerfilDisplayLabel={() => ''}
                createImagePreviewUrl={() => null}
                revokeImagePreviewUrl={() => undefined}
                readAuthTokenFromStorage={() => null}
                withAuthToken={(url) => url}
                PERSON_TAX_ID_LABEL="CUIL"
                COLLECTOR_TAX_ID_LABEL="CUIL cobrador"
                formatDateTime={() => ''}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(fetchMock).toHaveBeenCalled();

    const importeInput = await screen.findByLabelText(/importe a facturar$/i);
    const importeConDescuentoInput = await screen.findByLabelText(/importe a facturar con descuento/i);
    const clienteInput = await screen.findByLabelText(/cliente visual/i);

    await waitFor(() => {
      expect(clienteInput).toHaveValue('CLIENTE-ACME');
    });

    await waitFor(() => {
      expect(importeConDescuentoInput).toHaveValue('1955000');
    });

    await userEvent.type(importeInput, '3000000');

    await waitFor(() => {
      expect(importeConDescuentoInput).toHaveValue('2955000');
    });

    await userEvent.click(screen.getByRole('button', { name: /nueva liquidación/i }));

    await waitFor(() => {
      expect(importeInput).toHaveValue(null);
      expect(importeConDescuentoInput).toHaveValue('—');
      expect(clienteInput).toHaveValue('CLIENTE-ACME');
    });
  });

  test('Desplegable muestra liquidaciones por personal y permite abrir una', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '');

      if (url.includes('/api/personal?includePending=1')) {
        return buildJsonResponse({
          data: [
            {
              id: 1,
              nombre: 'Test User',
              cuil: '20-00000000-0',
              telefono: null,
              email: null,
              cliente: 'CLIENTE-ACME',
              unidad: null,
              unidadDetalle: null,
              sucursal: null,
              perfil: null,
              perfilValue: null,
              agente: null,
              estado: null,
              combustible: null,
              combustibleValue: false,
              tarifaEspecial: null,
              tarifaEspecialValue: false,
              aprobado: true,
              esSolicitud: false,
              liquidaciones: [
                {
                  id: 10,
                  fecha: '2026-02-01',
                  monthKey: '2026-02',
                  fortnightKey: 'Q1',
                  enviada: null,
                  recibido: null,
                  pagado: null,
                  importeFacturar: 1000,
                },
              ],
            },
          ],
        });
      }

      if (url.includes('/api/personal/documentos/tipos')) {
        return buildJsonResponse({
          data: [{ id: 10, nombre: 'Liquidación', vence: false }],
        });
      }

      if (url.includes('/api/personal/1?includePending=1')) {
        return buildJsonResponse({
          data: { id: 1, nombre: 'Test User', patente: 'AH066DM', documents: [] },
        });
      }

      return buildJsonResponse({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={['/liquidaciones']}>
        <Routes>
          <Route
            path="/liquidaciones"
            element={
              <LiquidacionesPage
                DashboardLayout={DashboardLayout as any}
                resolveApiBaseUrl={() => ''}
                useStoredAuthUser={() => null}
                buildActorHeaders={() => null}
                resolveApiUrl={() => null}
                parseJsonSafe={async (response) => (response as any).json()}
                formatCurrency={(value) => String(value ?? '')}
                formatPagoLabel={() => ''}
                getPerfilDisplayLabel={() => ''}
                createImagePreviewUrl={() => null}
                revokeImagePreviewUrl={() => undefined}
                readAuthTokenFromStorage={() => null}
                withAuthToken={(url) => url}
                PERSON_TAX_ID_LABEL="CUIL"
                COLLECTOR_TAX_ID_LABEL="CUIL cobrador"
                formatDateTime={() => ''}
              />
            }
          />
          <Route
            path="/liquidaciones/:personaId"
            element={
              <LiquidacionesPage
                DashboardLayout={DashboardLayout as any}
                resolveApiBaseUrl={() => ''}
                useStoredAuthUser={() => null}
                buildActorHeaders={() => null}
                resolveApiUrl={() => null}
                parseJsonSafe={async (response) => (response as any).json()}
                formatCurrency={(value) => String(value ?? '')}
                formatPagoLabel={() => ''}
                getPerfilDisplayLabel={() => ''}
                createImagePreviewUrl={() => null}
                revokeImagePreviewUrl={() => undefined}
                readAuthTokenFromStorage={() => null}
                withAuthToken={(url) => url}
                PERSON_TAX_ID_LABEL="CUIL"
                COLLECTOR_TAX_ID_LABEL="CUIL cobrador"
                formatDateTime={() => ''}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(fetchMock).toHaveBeenCalled();

    const toggleButton = await screen.findByRole('button', { name: /ver liquidaciones de/i });
    expect(toggleButton).not.toBeDisabled();
    await userEvent.click(toggleButton);

    expect(screen.getByText(/liquidación #10/i)).toBeInTheDocument();
    expect(screen.getByText(/febrero/i)).toBeInTheDocument();
    expect(screen.queryByText(/1000/)).not.toBeInTheDocument();

    expect(screen.getByText(/liquidación #10/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/personal/1?includePending=1', expect.anything());
  });
});

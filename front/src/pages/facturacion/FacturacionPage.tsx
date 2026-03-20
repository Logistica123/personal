import React from 'react';
import { Navigate } from 'react-router-dom';
import type { FacturacionPageContext } from './pageContext';

export const createFacturacionPage = (_ctx: FacturacionPageContext) => {
  const FacturacionPage: React.FC = () => <Navigate to="/facturacion/facturas" replace />;
  return FacturacionPage;
};


import React from 'react';
import { NavLink } from 'react-router-dom';
import type { FacturacionDeps } from '../../features/facturacion/deps';
import type { FacturacionShellComponent } from './pageContext';

const FacturacionNav: React.FC = () => (
  <div className="facturacion-nav">
    <NavLink to="/facturacion/facturas" className={({ isActive }) => `facturacion-nav__link${isActive ? ' is-active' : ''}`}>
      Listado
    </NavLink>
    <NavLink to="/facturacion/nueva" className={({ isActive }) => `facturacion-nav__link${isActive ? ' is-active' : ''}`}>
      Nueva factura
    </NavLink>
    <NavLink to="/facturacion/clientes" className={({ isActive }) => `facturacion-nav__link${isActive ? ' is-active' : ''}`}>
      Clientes
    </NavLink>
    <NavLink
      to="/facturacion/configuracion-arca"
      className={({ isActive }) => `facturacion-nav__link${isActive ? ' is-active' : ''}`}
    >
      Configuración ARCA
    </NavLink>
  </div>
);

export const createFacturacionShell = (DashboardLayout: FacturacionDeps['DashboardLayout']): FacturacionShellComponent => {
  const FacturacionShell: FacturacionShellComponent = ({ title, subtitle, headerActions, children }) => (
    <DashboardLayout
      title={title}
      subtitle={subtitle}
      headerContent={
        <div className="facturacion-header">
          <FacturacionNav />
          {headerActions ? <div className="facturacion-header__actions">{headerActions}</div> : null}
        </div>
      }
    >
      {children}
    </DashboardLayout>
  );

  return FacturacionShell;
};


ARBOL DE COMPONENTES Y WIREFRAME RAPIDO

Arbol de componentes
- FacturacionLayout
  - SidebarERP
  - TopBarERP
  - FacturasListadoPage
    - PageHeader
    - FilterBar
    - KpiGrid
      - KpiCard x5
    - FacturasTable
  - NuevaFacturaPage
    - PageHeader
    - FacturaForm
      - DatosArcaSection
      - ReceptorSection
      - VinculacionComercialSection
      - DetallePdfGrid
      - TotalesPanel
      - ActionBar
  - FacturaDetallePage
    - ResumenCabeceraCard
    - ClienteSucursalCard
    - ImportesCard
    - CaeCard
    - DetallePdfCard
    - TimelineEstadosCard
    - TimelineCobranzaCard
    - DescargasTecnicasCard
  - ConfiguracionArcaPage
    - EmisorTab
    - CertificadosTab
    - PuntosVentaTab
    - PruebasTecnicasTab
  - ClientesFacturacionPage
    - FilterBar
    - KpiGrid
    - ConsolidadoTable
  - ClienteFacturacionDetallePage
    - ResumenGrupoCard
    - FacturasGrupoTable

Wireframe rapido - listado
[Titulo + subtitulo]
[Filtros fila 1.................................................]
[Filtros fila 2.................................................]
[KPI 1] [KPI 2] [KPI 3] [KPI 4] [KPI 5]
[---------------------------------------------------------------]
[ Tabla de facturas                                             ]
[ numero | cliente | sucursal | fecha | total | estados | ... ]
[---------------------------------------------------------------]

Wireframe rapido - nueva factura
[Titulo + subtitulo]
[Datos ARCA.....................................................]
[Receptor.......................................................]
[Vinculacion comercial..........................................]
[Detalle PDF....................................................]
[Totales........................................................]
[ Guardar borrador ] [ Validar ] [ Emitir en ARCA ]

Wireframe rapido - clientes facturacion
[Titulo + subtitulo]
[Filtros.........................................................]
[KPI] [KPI] [KPI] [KPI]
[---------------------------------------------------------------]
[ Tabla consolidada por cliente/sucursal/periodo               ]

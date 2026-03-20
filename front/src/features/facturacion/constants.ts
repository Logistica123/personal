import { FACTURACION_COMPROBANTES_OPTIONS } from '../../facturacionComprobantes';

export const TARIFA_MONTH_OPTIONS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export const FACTURACION_PERIODOS = [
  { value: 'PRIMERA_QUINCENA', label: 'Primera quincena' },
  { value: 'SEGUNDA_QUINCENA', label: 'Segunda quincena' },
  { value: 'MES_COMPLETO', label: 'Mes completo' },
];

export const FACTURACION_ESTADOS_FISCALES = [
  'BORRADOR',
  'VALIDADA_LOCAL',
  'LISTA_PARA_ENVIO',
  'ENVIANDO_ARCA',
  'AUTORIZADA',
  'RECHAZADA_ARCA',
  'ERROR_TECNICO',
  'PDF_GENERADO',
];

export const FACTURACION_ESTADOS_COBRANZA = ['PENDIENTE', 'A_VENCER', 'VENCIDA', 'COBRADA', 'PARCIAL'];

export const FACTURACION_EMISOR_RAZON_SOCIAL = 'LOGISTICA ARGENTINA S.R.L.';
export const FACTURACION_EMISOR_CUIT = '30717060985';
export const FACTURACION_EMISOR_DOMICILIO = 'SAN CAYETANO 3470 - SAN CAYETANO';
export const FACTURACION_EMISOR_CONDICION_IVA = 'IVA Responsable Inscripto';

export const FACTURACION_DEFAULT_PTO_VTA = '11';
export const FACTURACION_DEFAULT_AMBIENTE: 'PROD' = 'PROD';
export const FACTURACION_DEFAULT_CERT_ALIAS = 'logarg-erp-wsfe-pv00011';

export const FACTURACION_CBTE_TIPO_FACTURA_A = '1';
export const FACTURACION_CBTE_TIPOS_REQUIEREN_ASOCIACION = new Set<number>([
  2, 3, 7, 8, 12, 13, // ND/NC A/B/C
  20, 21, // ND/NC exterior
  202, 203, 207, 208, 212, 213, // ND/NC FCE A/B/C
]);

export const FACTURACION_CBTE_ASOC_TIPOS = [
  '01',
  '02',
  '03',
  '06',
  '07',
  '08',
  '11',
  '12',
  '13',
  '201',
  '202',
  '203',
  '206',
  '207',
  '208',
  '211',
  '212',
  '213',
];

export const FACTURACION_CBTE_ASOC_OPTIONS = FACTURACION_COMPROBANTES_OPTIONS.filter((opt) =>
  FACTURACION_CBTE_ASOC_TIPOS.includes(opt.code)
);

export const FACTURACION_IVA_ALICUOTAS = [
  { id: 5, rate: 21 },
  { id: 4, rate: 10.5 },
  { id: 6, rate: 27 },
  { id: 3, rate: 5 },
  { id: 2, rate: 2.5 },
  { id: 1, rate: 0 },
];

export const FACTURACION_UNIDAD_MEDIDA_DEFAULT = 'Otras unidades';
export const FACTURACION_UNIDADES_MEDIDA_FALLBACK = [
  FACTURACION_UNIDAD_MEDIDA_DEFAULT,
  'Kilogramos',
  'Metros',
  'Metros cuadrados',
  'Metros cúbicos',
  'Litros',
  '1000 kWh',
  'Unidades',
  'Pares',
  'Docenas',
  'Quilates',
  'Millares',
  'Gramos',
  'Milímetros',
  'Milímetros cúbicos',
  'Kilómetros',
  'Hectolitros',
  'Centímetros',
  'Centímetros cúbicos',
  'Jgo. pqt. mazo naipes',
];

export const FACTURACION_ALICUOTA_PCT_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: '0', label: 'No gravado' },
  { value: '0', label: 'Exento' },
  { value: '0', label: '0%' },
  { value: '2.5', label: '2,5%' },
  { value: '5', label: '5%' },
  { value: '10.5', label: '10,5%' },
  { value: '21', label: '21%' },
  { value: '27', label: '27%' },
];

export const FACTURACION_CONDICIONES_VENTA = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta de Débito' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TRANSFERENCIA_BANCARIA', label: 'Transferencia bancaria' },
  { value: 'OTRA', label: 'Otra' },
  { value: 'OTROS_MEDIOS_PAGO_ELECTRONICO', label: 'Otros medios de pago electrónico' },
];


const tipoLabelOverrides: Record<string, string> = {
  'dis faltantes': 'Días faltantes',
  'dis_faltantes': 'Días faltantes',
  'dis-faltantes': 'Días faltantes',
  'dias faltantes': 'Días faltantes',
  'dias_faltantes': 'Días faltantes',
  'dias-faltantes': 'Días faltantes',
};

export const formatReclamoTipoLabel = (tipo?: string | null): string => {
  if (!tipo) {
    return '';
  }

  const normalized = tipo.trim();
  const key = normalized.replace(/[_-]/g, ' ').toLowerCase();
  return tipoLabelOverrides[key as keyof typeof tipoLabelOverrides] ?? normalized;
};

export const isReclamoAdelantoType = (tipo?: { nombre?: string | null; slug?: string | null } | null): boolean => {
  if (!tipo) {
    return false;
  }

  const slug = (tipo.slug ?? '').trim().toLowerCase();
  if (slug === 'reclamos-y-adelantos') {
    return true;
  }

  const normalizedName = (tipo.nombre ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  return normalizedName === 'reclamos y adelantos';
};

export const isReclamoAdelantoTypeName = (tipoNombre?: string | null): boolean => {
  const normalizedName = (tipoNombre ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  return normalizedName === 'reclamos y adelantos';
};

export const normalizeReclamosTipoQueryParam = (search: string): string => {
  return (new URLSearchParams(search).get('tipo') ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '-');
};

export const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) {
    return '—';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

export const formatElapsedTime = (fromIso: string | null, toIso?: string | null): string => {
  if (!fromIso) {
    return '—';
  }

  const fromDate = new Date(fromIso);
  if (Number.isNaN(fromDate.getTime())) {
    return '—';
  }

  const target = toIso ? new Date(toIso) : new Date();
  if (Number.isNaN(target.getTime())) {
    return '—';
  }

  const diffMs = Math.max(0, target.getTime() - fromDate.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes - days * 24 * 60) / 60);
  const minutes = diffMinutes - days * 24 * 60 - hours * 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 && parts.length < 2) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '0m';
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return '—';
  }

  return currencyFormatter.format(numeric);
};

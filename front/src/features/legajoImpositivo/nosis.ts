import type {
  NosisSnapshotRecord,
  TaxActivityRecord,
  TaxProfileRecord,
} from './types';

export const readTaxSnapshotParsedText = (
  parsed: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null => {
  if (!parsed) {
    return null;
  }

  for (const key of keys) {
    const value = parsed[key];
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

export const isTaxSnapshotSuccessful = (snapshot: NosisSnapshotRecord): boolean => {
  if (snapshot.valid) {
    return true;
  }

  const parsed = snapshot.parsed ?? null;
  const snapshotType = (snapshot.snapshotType ?? '').trim().toUpperCase();
  const resultadoEstado = readTaxSnapshotParsedText(parsed, ['resultadoEstado']);
  const resultadoNovedad = readTaxSnapshotParsedText(parsed, ['resultadoNovedad'])?.toLowerCase() ?? '';

  if (snapshotType === 'DOCUMENTO' && resultadoEstado === '200' && ['ok', 'validado', 'aprobado'].includes(resultadoNovedad)) {
    return true;
  }

  return false;
};

export const resolveTaxSnapshotTypeLabel = (snapshot: NosisSnapshotRecord): string => {
  const normalized = (snapshot.snapshotType ?? '').trim().toUpperCase();

  if (normalized === 'CBU') {
    return 'Validación bancaria';
  }
  if (normalized === 'DOCUMENTO') {
    return 'Consulta CUIT/CUIL';
  }

  return 'Consulta Nosis';
};

export const buildTaxSnapshotSummary = (snapshot: NosisSnapshotRecord) => {
  const parsed = snapshot.parsed ?? null;
  const snapshotType = (snapshot.snapshotType ?? '').trim().toUpperCase();
  const isSuccess = isTaxSnapshotSuccessful(snapshot);
  const razonSocial = readTaxSnapshotParsedText(parsed, ['razonSocial']);
  const arcaStatus = readTaxSnapshotParsedText(parsed, ['arcaStatus']);
  const dgrStatus = readTaxSnapshotParsedText(parsed, ['dgrStatus']);
  const bankOwnerName = readTaxSnapshotParsedText(parsed, [
    'bankOwnerName',
    'titularCuenta',
    'titular',
    'nombreTitular',
  ]);
  const bankOwnerDocument = readTaxSnapshotParsedText(parsed, [
    'bankOwnerDocument',
    'documentoTitular',
    'titularDocumento',
    'cuitTitular',
    'cuilTitular',
  ]);
  const resultText = readTaxSnapshotParsedText(
    parsed,
    snapshotType === 'CBU'
      ? ['cbuEstado', 'cbuNovedad', 'resultadoNovedad', 'message']
      : ['resultadoNovedad', 'message']
  ) ?? snapshot.message;

  const referenceParts = [snapshot.requestedAtLabel ?? 'Sin fecha'];
  if (snapshot.documento) {
    referenceParts.push(`CUIT/CUIL: ${snapshot.documento}`);
  }
  if (snapshot.cbu) {
    referenceParts.push(`CBU: ${snapshot.cbu}`);
  }

  const detailParts = [
    razonSocial,
    arcaStatus ? `ARCA: ${arcaStatus}` : null,
    dgrStatus ? `DGR: ${dgrStatus}` : null,
    bankOwnerName ? `Titular: ${bankOwnerName}` : null,
    bankOwnerDocument ? `Doc titular: ${bankOwnerDocument}` : null,
  ].filter(Boolean) as string[];

  return {
    typeLabel: resolveTaxSnapshotTypeLabel(snapshot),
    referenceText: referenceParts.join(' · '),
    detailText: detailParts.join(' · '),
    resultText,
    statusLabel: isSuccess ? 'Validado' : 'Observado',
    statusClassName: isSuccess ? 'badge badge--success' : 'badge badge--warning',
  };
};

const readTaxSnapshotParsedBoolean = (
  parsed: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean | null => {
  if (!parsed) {
    return null;
  }

  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (['si', 'sí', 's', 'true', '1', 'activo', 'validado'].includes(normalized)) {
      return true;
    }
    if (['no', 'false', '0', '-', 'inactivo', 'rechazado'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const readTaxSnapshotParsedNumber = (
  parsed: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null => {
  if (!parsed) {
    return null;
  }

  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value !== 'string') {
      continue;
    }

    const digits = value.trim().replace(/[^\d-]+/g, '');
    if (!digits || digits === '-') {
      continue;
    }

    const parsedNumber = Number(digits);
    if (!Number.isNaN(parsedNumber)) {
      return parsedNumber;
    }
  }

  return null;
};

const normalizeNosisDateValue = (value: string | null | undefined): string | null => {
  const raw = (value ?? '').trim();
  if (!raw) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }
  return null;
};

export const normalizeTaxActivities = (value: unknown): TaxActivityRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): TaxActivityRecord | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const index = typeof record.index === 'number' && Number.isFinite(record.index) ? record.index : null;
      const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : null;
      const description =
        typeof record.description === 'string' && record.description.trim() ? record.description.trim() : null;
      const sector = typeof record.sector === 'string' && record.sector.trim() ? record.sector.trim() : null;
      const startDate = normalizeNosisDateValue(typeof record.startDate === 'string' ? record.startDate : null);

      if (!code && !description && !sector && !startDate) {
        return null;
      }

      return {
        index,
        code,
        description,
        sector,
        startDate,
      };
    })
    .filter((item): item is TaxActivityRecord => item !== null);
};

const resolveParsedArcaStatus = (parsed: Record<string, unknown> | null | undefined): string | null => {
  const explicit = readTaxSnapshotParsedText(parsed, [
    'arcaStatus',
    'afipStatus',
    'estadoFiscal',
    'condicionFiscal',
    'afipKeyStatus',
  ]);
  if (explicit) {
    return explicit;
  }

  const novedad = readTaxSnapshotParsedText(parsed, ['resultadoNovedad', 'message']);
  const estado = readTaxSnapshotParsedText(parsed, ['resultadoEstado']);
  if (novedad && estado && estado !== '200') {
    return `${novedad} (código ${estado})`;
  }

  return novedad ?? (estado && estado !== '200' ? `Código ${estado}` : null);
};

export const mergeTaxProfileWithNosisParsed = (
  current: TaxProfileRecord,
  parsed: Record<string, unknown> | null | undefined
): TaxProfileRecord => {
  if (!parsed) {
    return current;
  }

  const next: TaxProfileRecord = { ...current };

  const assignText = (field: keyof TaxProfileRecord, keys: string[]) => {
    const value = readTaxSnapshotParsedText(parsed, keys);
    if (value !== null) {
      (next as Record<string, unknown>)[field as string] = value;
    }
  };

  const assignDate = (field: keyof TaxProfileRecord, keys: string[]) => {
    const value = normalizeNosisDateValue(readTaxSnapshotParsedText(parsed, keys));
    if (value !== null) {
      (next as Record<string, unknown>)[field as string] = value;
    }
  };

  const assignBoolean = (field: keyof TaxProfileRecord, keys: string[]) => {
    const value = readTaxSnapshotParsedBoolean(parsed, keys);
    if (value !== null) {
      (next as Record<string, unknown>)[field as string] = value;
    }
  };

  const assignNumber = (field: keyof TaxProfileRecord, keys: string[]) => {
    const value = readTaxSnapshotParsedNumber(parsed, keys);
    if (value !== null) {
      (next as Record<string, unknown>)[field as string] = value;
    }
  };

  assignText('cuit', ['documentoNormalizado', 'documento', 'VI_Identificacion', 'VI_DNI']);
  assignText('razonSocial', ['razonSocial', 'VI_RazonSocial']);
  const arcaStatus = resolveParsedArcaStatus(parsed);
  if (arcaStatus !== null) {
    (next as Record<string, unknown>).arcaStatus = arcaStatus;
  }
  assignText('dgrStatus', ['dgrStatus', 'estadoDgr', 'condicionDgr', 'ingresosBrutosEstado']);
  assignText('fiscalAddressStreet', ['fiscalAddressStreet', 'VI_DomAF_Calle']);
  assignText('fiscalAddressNumber', ['fiscalAddressNumber', 'VI_DomAF_Nro']);
  assignText('fiscalAddressFloor', ['fiscalAddressFloor', 'VI_DomAF_Piso']);
  assignText('fiscalAddressUnit', ['fiscalAddressUnit', 'VI_DomAF_Dto']);
  assignText('fiscalAddressLocality', ['fiscalAddressLocality', 'VI_DomAF_Loc']);
  assignText('fiscalAddressPostalCode', ['fiscalAddressPostalCode', 'VI_DomAF_CP']);
  assignText('fiscalAddressProvince', ['fiscalAddressProvince', 'VI_DomAF_Prov']);
  assignText('activityMainCode', ['activityMainCode', 'VI_Act01_Cod']);
  assignText('activityMainDescription', ['activityMainDescription', 'VI_Act01_Descrip']);
  assignText('activityMainSector', ['activityMainSector', 'VI_Act01_Sector']);
  assignDate('activityMainStartDate', ['activityMainStartDate', 'VI_Act01_FecInicio']);
  if (Array.isArray((parsed as any).activities)) {
    next.activities = normalizeTaxActivities((parsed as any).activities);
  }
  assignText('afipKeyStatus', ['afipKeyStatus', 'VI_Inscrip_EstadoClave']);
  assignDate('afipKeyStatusDate', ['afipKeyStatusDate', 'VI_Inscrip_EstadoClave_Fecha']);
  assignBoolean('ivaRegistered', ['ivaRegistered', 'VI_Inscrip_IVA']);
  assignBoolean('ivaWithholdingExclusion', ['ivaWithholdingExclusion', 'VI_Inscrip_IVA_Excluido']);
  assignDate('ivaRegisteredAt', ['ivaRegisteredAt', 'VI_Inscrip_IVA_Fec']);
  assignText('ivaCondition', ['ivaCondition', 'VI_Inscrip_IVA_Condicion']);
  assignBoolean('gananciasRegistered', ['gananciasRegistered', 'VI_Inscrip_GCIA']);
  assignBoolean('gananciasWithholdingExclusion', ['gananciasWithholdingExclusion', 'VI_Inscrip_Gcia_Excluido']);
  assignDate('gananciasRegisteredAt', ['gananciasRegisteredAt', 'VI_Inscrip_Gcia_Fec']);
  assignText('gananciasCondition', ['gananciasCondition', 'VI_Inscrip_GCIA_Condicion']);
  assignBoolean('monotributoRegistered', ['monotributoRegistered', 'VI_Inscrip_Monotributo_Es']);
  assignDate('monotributoRegisteredAt', ['monotributoRegisteredAt', 'VI_Inscrip_Monotributo_Fec']);
  assignText('monotributoCategory', ['monotributoCategory', 'VI_Inscrip_Monotributo']);
  assignText('monotributoType', ['monotributoType', 'VI_Inscrip_Monotributo_Tipo']);
  assignText('monotributoActivity', ['monotributoActivity', 'VI_Inscrip_Monotributo_Act']);
  assignNumber('monotributoSeniorityMonths', ['monotributoSeniorityMonths', 'VI_Inscrip_Monotributo_Antiguedad']);
  assignBoolean('isEmployee', ['isEmployee', 'VI_Empleado_Es']);
  assignBoolean('isEmployer', ['isEmployer', 'VI_Empleador_Es']);
  assignBoolean('isRetired', ['isRetired', 'VI_Jubilado_Es']);

  return next;
};


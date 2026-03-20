export type NosisSnapshotRecord = {
  id: number;
  snapshotType: string | null;
  documento: string | null;
  cbu: string | null;
  valid: boolean;
  message: string | null;
  requestedAt: string | null;
  requestedAtLabel?: string | null;
  parsed?: Record<string, unknown> | null;
};

export type ClientTaxDocumentRecord = {
  id: number;
  category: string | null;
  title: string | null;
  description: string | null;
  fechaVencimiento: string | null;
  mime: string | null;
  size: number | null;
  originalName: string | null;
  createdAt: string | null;
  downloadUrl: string | null;
};

export type TaxActivityRecord = {
  index?: number | null;
  code: string | null;
  description: string | null;
  sector: string | null;
  startDate: string | null;
};

export type TaxProfileRecord = {
  id?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  cuit: string | null;
  razonSocial: string | null;
  arcaStatus: string | null;
  dgrStatus: string | null;
  fiscalAddressStreet: string | null;
  fiscalAddressNumber: string | null;
  fiscalAddressFloor: string | null;
  fiscalAddressUnit: string | null;
  fiscalAddressLocality: string | null;
  fiscalAddressPostalCode: string | null;
  fiscalAddressProvince: string | null;
  activityMainCode: string | null;
  activityMainDescription: string | null;
  activityMainSector: string | null;
  activityMainStartDate: string | null;
  activities?: TaxActivityRecord[];
  afipKeyStatus: string | null;
  afipKeyStatusDate: string | null;
  ivaRegistered: boolean | null;
  ivaWithholdingExclusion: boolean | null;
  ivaRegisteredAt: string | null;
  ivaCondition: string | null;
  gananciasRegistered: boolean | null;
  gananciasWithholdingExclusion: boolean | null;
  gananciasRegisteredAt: string | null;
  gananciasCondition: string | null;
  monotributoRegistered: boolean | null;
  monotributoRegisteredAt: string | null;
  monotributoCategory: string | null;
  monotributoType: string | null;
  monotributoActivity: string | null;
  monotributoSeniorityMonths: number | null;
  isEmployee: boolean | null;
  isEmployer: boolean | null;
  isRetired: boolean | null;
  exclusionNotes: string | null;
  exemptionNotes: string | null;
  regimeNotes: string | null;
  bankAccount: string | null;
  bankAlias: string | null;
  bankOwnerName: string | null;
  bankOwnerDocument: string | null;
  bankValidationStatus: string | null;
  insuranceNotes: string | null;
  observations: string | null;
  latestNosisSnapshot?: NosisSnapshotRecord | null;
  snapshots?: NosisSnapshotRecord[];
  documents?: ClientTaxDocumentRecord[];
};


// Validación de CBU bancario argentino: 22 dígitos numéricos exactos.
//
// Se decidió forzar el formato numérico (sin permitir alias alfanuméricos)
// porque operativamente cargaban con "1" y otros valores inválidos. Si más
// adelante se necesita aceptar alias, ampliar `validarCbu` para soportar
// el formato CBU O alias y exportar otra variante.

export const sanitizarCbu = (raw: string): string =>
  raw.replace(/\D/g, '').slice(0, 22);

export type ValidacionCbu = { ok: boolean; error?: string };

export const validarCbu = (value: string): ValidacionCbu => {
  if (!value) return { ok: true };  // vacío permitido (campo opcional)
  if (!/^\d{22}$/.test(value)) {
    return { ok: false, error: `CBU inválido — deben ser 22 dígitos (tenés ${value.length}).` };
  }
  return { ok: true };
};

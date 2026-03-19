export type Sucursal = {
  id: number | null;
  nombre: string | null;
  direccion: string | null;
  encargado_deposito?: string | null;
};

export type Cliente = {
  id: number;
  codigo: string | null;
  nombre: string | null;
  direccion: string | null;
  documento_fiscal: string | null;
  logo_url?: string | null;
  sucursales: Sucursal[];
};


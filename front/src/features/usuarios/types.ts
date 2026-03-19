export type Usuario = {
  id: number;
  name: string | null;
  email: string | null;
  created_at: string | null;
  status?: string | null;
  role?: string | null;
  permissions?: string[] | null;
};


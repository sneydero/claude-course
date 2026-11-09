function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  return value;
}

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  dbPath: process.env['DB_PATH'] ?? 'data/snap.db',
  jwtSecret: required('JWT_SECRET'),
} as const;

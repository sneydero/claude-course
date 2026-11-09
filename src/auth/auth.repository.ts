import type Database from 'better-sqlite3';

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

const toRecord = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  name: r.name,
  createdAt: r.created_at,
});

export function createAuthRepository(db: Database.Database) {
  const insert = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
  const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');

  return {
    /** Devuelve el usuario creado, o undefined si el email ya existe. */
    insert(email: string, passwordHash: string, name: string): UserRecord | undefined {
      try {
        const info = insert.run(email, passwordHash, name);
        return toRecord(
          db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow,
        );
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return undefined;
        throw err;
      }
    },
    findByEmail(email: string): UserRecord | undefined {
      const row = byEmail.get(email) as UserRow | undefined;
      return row && toRecord(row);
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;

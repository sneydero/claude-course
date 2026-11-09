import type Database from 'better-sqlite3';

export interface UrlRecord {
  id: number;
  code: string;
  longUrl: string;
  /** null en URLs creadas antes de existir la autenticación. */
  userId: number | null;
  createdAt: string;
}

interface UrlRow {
  id: number;
  code: string;
  long_url: string;
  user_id: number | null;
  created_at: string;
}

const toRecord = (r: UrlRow): UrlRecord => ({
  id: r.id,
  code: r.code,
  longUrl: r.long_url,
  userId: r.user_id,
  createdAt: r.created_at,
});

export function createUrlsRepository(db: Database.Database) {
  const insert = db.prepare('INSERT INTO urls (code, long_url, user_id) VALUES (?, ?, ?)');
  const byCode = db.prepare('SELECT * FROM urls WHERE code = ?');
  const all = db.prepare('SELECT * FROM urls ORDER BY id DESC');
  const insertClick = db.prepare('INSERT INTO clicks (url_id, user_agent) VALUES (?, ?)');
  const remove = db.prepare('DELETE FROM urls WHERE code = ? AND user_id = ?');

  return {
    /** Devuelve false si el código ya existe. */
    insert(code: string, longUrl: string, userId: number): boolean {
      try {
        insert.run(code, longUrl, userId);
        return true;
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
        throw err;
      }
    },
    findByCode(code: string): UrlRecord | undefined {
      const row = byCode.get(code) as UrlRow | undefined;
      return row && toRecord(row);
    },
    list(): UrlRecord[] {
      return (all.all() as UrlRow[]).map(toRecord);
    },
    recordClick(urlId: number, userAgent: string | null): void {
      insertClick.run(urlId, userAgent);
    },
    /** Borra solo si pertenece al usuario. Devuelve true si se borró. */
    deleteOwned(code: string, userId: number): boolean {
      return remove.run(code, userId).changes > 0;
    },
  };
}

export type UrlsRepository = ReturnType<typeof createUrlsRepository>;

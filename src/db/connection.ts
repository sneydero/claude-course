import Database from 'better-sqlite3';

export function createDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Espera hasta 5 s por el lock de escritura en vez de fallar con SQLITE_BUSY.
  db.pragma('busy_timeout = 5000');
  return db;
}

import type Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS urls (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT NOT NULL UNIQUE,
      long_url   TEXT NOT NULL,
      user_id    INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- clicked_at usa el mismo formato ISO (UTC, con milisegundos) que se genera en
    -- JS con toISOString(): las comparaciones de texto equivalen a las cronológicas.
    CREATE TABLE IF NOT EXISTS clicks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url_id     INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
      clicked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_url_time ON clicks(url_id, clicked_at);
  `);

  // Bases de datos creadas antes de existir la propiedad de URLs.
  const columns = db.pragma('table_info(urls)') as { name: string }[];
  if (!columns.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users(id)');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id)');
}

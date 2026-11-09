import { createApp } from './app.js';
import { config } from './config/env.js';
import { createDb } from './db/connection.js';
import { migrate } from './db/schema.js';

const db = createDb(config.dbPath);
migrate(db);

createApp(db, { jwtSecret: config.jwtSecret }).listen(config.port, () => {
  console.log(`Snap escuchando en http://localhost:${config.port}`);
});

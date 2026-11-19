// In-memory Postgres (PGlite) on a local port, for development and tests
// when no real database is available. Data is lost when the process exits.
//   node scripts/local-db.mjs [port]
// then DATABASE_URL=postgres://postgres:postgres@127.0.0.1:<port>/postgres
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.argv[2] ?? 5433);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`PGlite listening on postgres://postgres:postgres@127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

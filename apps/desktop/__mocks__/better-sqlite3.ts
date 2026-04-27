/**
 * Vitest mock for better-sqlite3.
 *
 * better-sqlite3 is a native module compiled against Electron's Node ABI, which
 * differs from the system Node ABI used by vitest. This mock replaces it with
 * sql.js (pure JS/WASM) so tests run without needing a native rebuild.
 *
 * The mock is picked up automatically by vitest because the vitest config
 * aliases "better-sqlite3" to this file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import nodePath from "node:path";

import type { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from "sql.js";

// sql-asm.js is the pure-JS (no WASM file) build — works in any Node env.
// oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
const initSqlJs = require("sql.js/dist/sql-asm.js") as () => Promise<SqlJsStatic>;

// sql.js initialisation is async but better-sqlite3 is sync.
// We initialise once at module load time; by the time any test constructs a
// Database (which always happens after at least one `await`), the promise has
// resolved.
let SQL: SqlJsStatic | null = null;
let sqlReadyError: unknown = null;

// Kick off initialisation immediately.
const sqlReady = initSqlJs().then(
  (s) => {
    SQL = s;
  },
  (e: unknown) => {
    sqlReadyError = e;
  },
);

function getSql(): SqlJsStatic {
  if (SQL) return SQL;
  if (sqlReadyError) throw sqlReadyError;
  throw new Error(
    "sql.js is not yet initialised. Ensure Database is constructed after an await in tests.",
  );
}

/** Maps named params like @foo to positional ? and extracts the values. */
function prepareParams(sql: string, params: unknown): { sql: string; values: SqlValue[] } {
  // Named object params: { name: value, ... } — better-sqlite3 uses @name in SQL
  if (params !== null && typeof params === "object" && !Array.isArray(params)) {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const record = params as Record<string, SqlValue>;
    const values: SqlValue[] = [];
    const mapped = sql.replace(/@(\w+)/g, (_match, key: string) => {
      values.push(record[key] ?? null);
      return "?";
    });
    return { sql: mapped, values };
  }

  // Positional array params
  if (Array.isArray(params)) {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    return { sql, values: params as SqlValue[] };
  }

  // Single primitive param — wrap in array
  if (params !== undefined && params !== null) {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    return { sql, values: [params as SqlValue] };
  }

  return { sql, values: [] };
}

class Statement {
  private readonly db: SqlJsDatabase;
  private readonly rawSql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.rawSql = sql;
  }

  get(...args: unknown[]): unknown {
    // better-sqlite3 .get() accepts positional spread args or a single named-param object
    const params = args.length === 1 ? args[0] : args;
    const { sql, values } = prepareParams(this.rawSql, params);
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(values);
      if (!stmt.step()) return undefined;
      return stmt.getAsObject();
    } finally {
      stmt.free();
    }
  }

  run(...args: unknown[]): { changes: number } {
    const params = args.length === 1 ? args[0] : args;
    const { sql, values } = prepareParams(this.rawSql, params);
    this.db.run(sql, values);
    return { changes: 0 };
  }

  all(...args: unknown[]): unknown[] {
    const params = args.length === 1 ? args[0] : args;
    const { sql, values } = prepareParams(this.rawSql, params);
    const stmt = this.db.prepare(sql);
    const rows: unknown[] = [];
    try {
      stmt.bind(values);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }
    return rows;
  }
}

class Database {
  private readonly sqlDb: SqlJsDatabase;
  private readonly dbPath: string | null;

  constructor(dbPath: string) {
    const sql = getSql();
    this.dbPath = dbPath && dbPath !== ":memory:" ? dbPath : null;

    if (this.dbPath) {
      mkdirSync(nodePath.dirname(this.dbPath), { recursive: true });
      if (existsSync(this.dbPath)) {
        // Load persisted data from disk (simulates reopening the db after a restart).
        const data = readFileSync(this.dbPath);
        this.sqlDb = new sql.Database(data);
      } else {
        // Create a new in-memory db and touch the file on disk so existsSync() checks pass.
        this.sqlDb = new sql.Database();
        writeFileSync(this.dbPath, Buffer.alloc(0));
      }
    } else {
      this.sqlDb = new sql.Database();
    }
  }

  pragma(statement: string, opts?: { simple?: boolean }): unknown {
    // WAL mode and other pragmas are no-ops in the in-memory mock.
    // Return a plausible value when simple: true is requested.
    const match = /journal_mode/i.exec(statement);
    if (match && opts?.simple) return "wal";
    return [];
  }

  exec(sql: string): void {
    this.sqlDb.run(sql);
  }

  prepare(sql: string): Statement {
    return new Statement(this.sqlDb, sql);
  }

  close(): void {
    // Persist the in-memory database to disk before closing so that
    // reopening it (simulating an app restart) sees the written data.
    if (this.dbPath) {
      writeFileSync(this.dbPath, Buffer.from(this.sqlDb.export()));
    }
    this.sqlDb.close();
  }
}

// Export the sqlReady promise so tests can await it if needed.
export { sqlReady };

export default Database;

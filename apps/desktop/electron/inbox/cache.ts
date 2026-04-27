import path from "node:path";

import Database from "better-sqlite3";
import { app } from "electron";

export const CACHE_DB_FILE_NAME = "open-warden-cache.db";
export const PR_CACHE_TTL_MS = 2 * 60_000;
export const IDENTITY_CACHE_TTL_MS = 24 * 60 * 60_000;

export interface InboxSnapshotRow {
  repoPath: string;
  scope: string;
  dataJson: string;
  fetchedAt: number;
  isPartial: boolean;
}

export interface CacheMetadataRow {
  key: string;
  value: string;
  updatedAt: number;
}

export interface UserIdentityRow {
  providerId: string;
  uuid: string | null;
  accountId: string | null;
  login: string | null;
  displayName: string | null;
  fetchedAt: number;
}

interface InboxSnapshotRecord {
  repo_path: string;
  scope: string;
  data_json: string;
  fetched_at: number;
  is_partial: number;
}

interface CacheMetadataRecord {
  key: string;
  value: string;
  updated_at: number;
}

interface UserIdentityRecord {
  provider_id: string;
  uuid: string | null;
  account_id: string | null;
  login: string | null;
  display_name: string | null;
  fetched_at: number;
}

type DatabaseInstance = InstanceType<typeof Database>;

let db: DatabaseInstance | null = null;

function resolveCacheDbPath(): string {
  return path.join(app.getPath("userData"), CACHE_DB_FILE_NAME);
}

function initializeSchema(sqlite: DatabaseInstance): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS inbox_snapshots (
      repo_path TEXT NOT NULL,
      scope TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      is_partial INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(repo_path, scope)
    );

    CREATE TABLE IF NOT EXISTS cache_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_identity (
      provider_id TEXT PRIMARY KEY,
      uuid TEXT,
      account_id TEXT,
      login TEXT,
      display_name TEXT,
      fetched_at INTEGER NOT NULL
    );
  `);
}

function toInboxSnapshotRow(record: InboxSnapshotRecord | undefined): InboxSnapshotRow | null {
  if (!record) {
    return null;
  }

  return {
    repoPath: record.repo_path,
    scope: record.scope,
    dataJson: record.data_json,
    fetchedAt: record.fetched_at,
    isPartial: Boolean(record.is_partial),
  };
}

function toCacheMetadataRow(record: CacheMetadataRecord | undefined): CacheMetadataRow | null {
  if (!record) {
    return null;
  }

  return {
    key: record.key,
    value: record.value,
    updatedAt: record.updated_at,
  };
}

function toUserIdentityRow(record: UserIdentityRecord | undefined): UserIdentityRow | null {
  if (!record) {
    return null;
  }

  return {
    providerId: record.provider_id,
    uuid: record.uuid,
    accountId: record.account_id,
    login: record.login,
    displayName: record.display_name,
    fetchedAt: record.fetched_at,
  };
}

export function getDb(): DatabaseInstance {
  if (!db) {
    const sqlite = new Database(resolveCacheDbPath());
    sqlite.pragma("journal_mode = WAL");
    initializeSchema(sqlite);
    db = sqlite;
  }

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

export function getInboxSnapshot(repoPath: string, scope: string): InboxSnapshotRow | null {
  const record = getDb()
    .prepare<InboxSnapshotRecord | undefined>(
      `SELECT repo_path, scope, data_json, fetched_at, is_partial
       FROM inbox_snapshots
       WHERE repo_path = ? AND scope = ?`,
    )
    .get(repoPath, scope);

  return toInboxSnapshotRow(record);
}

export function setInboxSnapshot(snapshot: InboxSnapshotRow): void {
  getDb()
    .prepare(
      `INSERT INTO inbox_snapshots (repo_path, scope, data_json, fetched_at, is_partial)
       VALUES (@repo_path, @scope, @data_json, @fetched_at, @is_partial)
       ON CONFLICT(repo_path, scope) DO UPDATE SET
         data_json = excluded.data_json,
         fetched_at = excluded.fetched_at,
         is_partial = excluded.is_partial`,
    )
    .run({
      repo_path: snapshot.repoPath,
      scope: snapshot.scope,
      data_json: snapshot.dataJson,
      fetched_at: snapshot.fetchedAt,
      is_partial: snapshot.isPartial ? 1 : 0,
    });
}

export function getCacheMetadata(key: string): CacheMetadataRow | null {
  const record = getDb()
    .prepare<CacheMetadataRecord | undefined>(
      `SELECT key, value, updated_at
       FROM cache_metadata
       WHERE key = ?`,
    )
    .get(key);

  return toCacheMetadataRow(record);
}

export function setCacheMetadata(metadata: CacheMetadataRow): void {
  getDb()
    .prepare(
      `INSERT INTO cache_metadata (key, value, updated_at)
       VALUES (@key, @value, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run({
      key: metadata.key,
      value: metadata.value,
      updated_at: metadata.updatedAt,
    });
}

export function getUserIdentity(providerId: string): UserIdentityRow | null {
  const record = getDb()
    .prepare<UserIdentityRecord | undefined>(
      `SELECT provider_id, uuid, account_id, login, display_name, fetched_at
       FROM user_identity
       WHERE provider_id = ?`,
    )
    .get(providerId);

  return toUserIdentityRow(record);
}

export function setUserIdentity(identity: UserIdentityRow): void {
  getDb()
    .prepare(
      `INSERT INTO user_identity (provider_id, uuid, account_id, login, display_name, fetched_at)
       VALUES (@provider_id, @uuid, @account_id, @login, @display_name, @fetched_at)
       ON CONFLICT(provider_id) DO UPDATE SET
         uuid = excluded.uuid,
         account_id = excluded.account_id,
         login = excluded.login,
         display_name = excluded.display_name,
         fetched_at = excluded.fetched_at`,
    )
    .run({
      provider_id: identity.providerId,
      uuid: identity.uuid,
      account_id: identity.accountId,
      login: identity.login,
      display_name: identity.displayName,
      fetched_at: identity.fetchedAt,
    });
}

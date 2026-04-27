declare module "better-sqlite3" {
  export interface Statement<Result = unknown> {
    get(...params: unknown[]): Result | undefined;
    run(...params: unknown[]): unknown;
  }

  export interface Database {
    pragma(statement: string): unknown;
    exec(statement: string): void;
    prepare<Result = unknown>(statement: string): Statement<Result>;
    close(): void;
  }

  const Database: {
    new (path: string): Database;
  } & {
    Database: Database;
  };

  export default Database;
}

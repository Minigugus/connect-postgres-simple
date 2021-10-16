import type { Sql } from 'postgres'
import type * as ExpressSession from 'express-session'
import type { EventEmitter } from 'node:events'

export interface PostgresStoreOptions extends EventEmitterOptions {
  postgres?: Sql<any>;
  tableName?: string;
  schemaName?: string;
  ttl?: number;
  disableTouch?: boolean;
  createTableIfMissing?: boolean;
  pruneSessionInterval?: false | number;
  pruneSessionRandomizedInterval?: false | ((delay: number) => number);
  errorLog?: (message: string, err: unknown) => void;
}

declare class PostgresStore extends ExpressSession.Store {
  constructor(options?: PostgresStoreOptions);

  get(sid: string, callback: (err: any, session?: ExpressSession.SessionData | null) => void): void;
  set(sid: string, session: ExpressSession.SessionData, callback?: (err?: any) => void): void;
  destroy(sid: string, callback?: (err?: any) => void): void;
  all(callback: (err: any, obj?: ExpressSession.SessionData[] | { [sid: string]: ExpressSession.SessionData; } | null) => void): void;
  length(callback: (err: any, length: number) => void): void;
  clear(callback?: (err?: any) => void): void;
  touch(sid: string, session: ExpressSession.SessionData, callback?: () => void): void;

  close(): Promise<void>;
  pruneSessions(callback?: (err?: any) => void): Promise<void>;
}

type PostgresStoreCtor = typeof PostgresStore;

export type { PostgresStore, PostgresStoreCtor };

type EventEmitterOptions = NonNullable<((typeof EventEmitter) extends new (options: infer R) => any ? R : never)>;

interface PostgresSession {
  sid: string,
  sess: ExpressSession.SessionData,
  expire: number
}

const delayUnref = (duration: number) => new Promise(res => setTimeout(res, duration).unref());

export default ({ Store }: typeof import('express-session')): typeof PostgresStore => class PostgresStore extends Store implements ExpressSession.Store {
  private postgres: Sql<any>;
  private tableName: string;
  private ttl: number;
  private disableTouch: boolean;
  private tableCreationPromise: Promise<unknown> | null = null;
  private closed: boolean = false;

  public constructor(options: PostgresStoreOptions = {}) {
    super(options);
    this.postgres = options.postgres ?? require('postgres')();
    this.tableName = options.tableName ?? 'session'
    if (options.schemaName !== undefined)
      this.tableName = `${options.schemaName}.${this.tableName}`;
    this.ttl = options.ttl ?? 86400; // One day by default
    this.tableCreationPromise = !options.createTableIfMissing
      ? Promise.resolve() // disable lazy-loading
      : null;
    this.disableTouch = options.disableTouch ?? false;
    if (options.pruneSessionInterval !== false)
      (async (interval, randomize, errorLog) => {
        while (!this.closed) {
          try {
            await delayUnref(randomize(interval));
            if (!this.closed)
              await this.pruneSessions();
          } catch (err) {
            errorLog('Failed to prune sessions:', err);
          }
        }
      })(
        // interval
        (options.pruneSessionInterval ?? 60 * 15) * 1000,

        // randomize
        options.pruneSessionRandomizedInterval !== false ? options.pruneSessionRandomizedInterval !== undefined
          ? options.pruneSessionRandomizedInterval // user-provided randomizer
          : ((delay: number) => Math.ceil(delay / 2 + delay * Math.random())) // default randomizer
          : ((delay: number) => delay), // no randomizer

        // errorLog
        options.errorLog ?? console.error.bind(console)
      )
  }

  private async beforeDatabaseAccess() {
    if (this.closed)
      throw new Error('Store closed by the user');

    // only true when `options.createTableIfMissing` is true and
    // this is the first call to `createTableIfNeeded()`
    if (this.tableCreationPromise === null)
      this.tableCreationPromise =
        this.postgres<[{ result: object | null }]>`SELECT to_regclass(${this.tableName}::text) AS result`
          .catch(() => [{ result: null }])
          .then(async ([{ result }]) => {
            if (result !== null) // table exists
              return;

            // we cannot use `this.postgres.file` here because
            // the table name must match `this.tableName`

            // we use .. because this code will be compiled
            // to /dist/index.js but we need /table.sql 
            const tableFile = require('path').resolve(__dirname, '../table.sql');

            const escapedTableName =
              this.tableName
                .replace(/"/g, '""')
                .replace(/^([^"]+)""\.""([^"]+)$/, '$1"."$2');

            const createTable = await require('fs').promises.readFile(tableFile, 'utf8');

            await this.postgres.unsafe(
              createTable
                .replace(/"session"/g, escapedTableName)
            );
          })

    await this.tableCreationPromise;
  }

  private getExpireTime(sess: ExpressSession.SessionData) {
    return new Date(Math.ceil((
      sess?.cookie?.expires ?? new Date(Date.now() + this.ttl * 1000)
    ).getTime() / 1000) * 1000);
  }

  async pruneSessions(callback: (err?: any) => void = () => { }) {
    const now = new Date(Math.ceil(Date.now() / 1000) * 1000);
    try {
      await this.beforeDatabaseAccess();
      await this.postgres`
        DELETE FROM ${this.postgres(this.tableName)}
        WHERE expire < ${now}
      `
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async close() {
    if (this.closed)
      return;
    this.closed = true;
    await this.postgres.end();
  }

  async get(sid: string, callback: (err: any, session?: ExpressSession.SessionData | null) => void) {
    try {
      await this.beforeDatabaseAccess();
      const [{ sess } = { sess: null }] = await this.postgres<[Pick<PostgresSession, 'sess'>?]>`
        SELECT sess
        FROM ${this.postgres(this.tableName)}
        WHERE sid = ${sid}
      `;
      callback(null, sess);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: ExpressSession.SessionData, callback?: (err?: any) => void) {
    try {
      await this.beforeDatabaseAccess();
      const sess = this.postgres.json(session);
      const expire = this.getExpireTime(session);
      await this.postgres`
        INSERT INTO ${this.postgres(this.tableName)} (sess, expire, sid)
        VALUES (${sess}, ${expire}, ${sid})
        ON CONFLICT (sid) DO UPDATE
        SET sess = ${sess}, expire = ${expire}
      `;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.beforeDatabaseAccess();
      await this.postgres`
        DELETE FROM ${this.postgres(this.tableName)}
        WHERE sid = ${sid}
      `;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async all(callback: (err: any, obj?: ExpressSession.SessionData[] | { [sid: string]: ExpressSession.SessionData; } | null) => void) {
    try {
      await this.beforeDatabaseAccess();
      const sessions: ExpressSession.SessionData[] = [];
      await this.postgres<Pick<PostgresSession, 'sess'>[]>`
        SELECT sess FROM ${this.postgres(this.tableName)}
      `
        .stream(({ sess }) => sessions.push(sess))
      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }

  async length(callback: (err: any, length: number) => void) {
    try {
      await this.beforeDatabaseAccess();
      const [{ length }] = await this.postgres<[{ length: number }]>`
        SELECT COUNT(sid) AS length
        FROM ${this.postgres(this.tableName)}
      `
      callback(null, length);
    } catch (err) {
      callback(err, 0);
    }
  }

  async clear(callback?: (err?: any) => void) {
    try {
      await this.beforeDatabaseAccess();
      await this.postgres`
        DELETE FROM ${this.postgres(this.tableName)}
      `;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(sid: string, session: ExpressSession.SessionData, callback?: () => void) {
    if (!this.disableTouch)
      try {
        await this.beforeDatabaseAccess();
        // SET expire = ${new Date((Math.ceil(Date.now() / 1000) + this.ttl) * 1000)}
        const res = await this.postgres`
          UPDATE ${this.postgres(this.tableName)}
          SET expire = ${this.getExpireTime(session)}
          WHERE sid = ${sid}
        `;
      } catch (err) { }
    callback?.();
  }
}

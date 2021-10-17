/// <reference types="node" />
import type { Sql } from 'postgres';
import type * as ExpressSession from 'express-session';
import type { EventEmitter } from 'node:events';
export interface PostgresStoreOptions extends EventEmitterOptions {
    postgres: Sql<any>;
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
    constructor(options: PostgresStoreOptions);
    get(sid: string, callback: (err: any, session?: ExpressSession.SessionData | null) => void): void;
    set(sid: string, session: ExpressSession.SessionData, callback?: (err?: any) => void): void;
    destroy(sid: string, callback?: (err?: any) => void): void;
    all(callback: (err: any, obj?: ExpressSession.SessionData[] | {
        [sid: string]: ExpressSession.SessionData;
    } | null) => void): void;
    length(callback: (err: any, length: number) => void): void;
    clear(callback?: (err?: any) => void): void;
    touch(sid: string, session: ExpressSession.SessionData, callback?: () => void): void;
    close(): Promise<void>;
    pruneSessions(callback?: (err?: any) => void): Promise<void>;
}
declare type PostgresStoreCtor = typeof PostgresStore;
export type { PostgresStore, PostgresStoreCtor };
declare type EventEmitterOptions = NonNullable<((typeof EventEmitter) extends new (options: infer R) => any ? R : never)>;
declare const _default: ({ Store }: typeof import('express-session')) => typeof PostgresStore;
export default _default;

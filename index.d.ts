import {
  PostgresStore,
  PostgresStoreCtor,
  PostgresStoreOptions
} from './dist/index';

declare function connectPostgresSimple({ Store }: typeof import('express-session')): PostgresStoreCtor;

declare namespace connectPostgresSimple {
  export type { PostgresStore, PostgresStoreOptions }
}

export = connectPostgresSimple;

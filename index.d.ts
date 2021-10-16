declare function postgresStore({ Store }: typeof import('express-session')): import('./dist/index').PostgresStoreCtor;

declare namespace postgresStore {
  export type PostgresStore = import('./dist/index').PostgresStore;
  export type PostgresStoreOptions = import('./dist/index').PostgresStoreOptions;
}

export = postgresStore;

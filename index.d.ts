export type PostgresStore = import('./dist/index').PostgresStore;
export type PostgresStoreOptions = import('./dist/index').PostgresStoreOptions;

export = (await import('./dist/index')).default;

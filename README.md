# Connect Postgres Simple

> Like [`connect-pg-simple`](https://github.com/voxpelli/node-connect-pg-simple) but using [`postgres`](https://npmjs.com/package/postgres) instead of [`pg`](https://npmjs.com/package/pg).
>
> Strong compatibility with `connect-pg-simple`:
>  * Can be used on the same sql table at the same time
>  * Same configuration options (expected `pg` related properties that were removed)

A simple, minimal PostgreSQL session store for Express/Connect using [`postgres`](https://npmjs.com/package/postgres)

## Installation

```bash
npm install connect-postgres-simple
```

**Once npm installed the module, you need to create the _"session"_ table in your database.**

For that you can use the [table.sql](table.sql) file provided with the module:

```bash
psql mydatabase < node_modules/connect-postgres-simple/table.sql
```

Or simply play the file via a GUI, like the pgAdminIII queries tool.

Or instruct this module to create it itself, by setting the `createTableIfMissing` option.

Note that `connect-postgres-simple` requires PostgreSQL version 9.5 or above.

## Usage

Examples are based on Express 4.

Simple example:

```javascript
const session = require('express-session');

app.use(session({
  store: new (require('connect-postgres-simple')(session))({
    // Insert connect-postgres-simple options here
  }),
  secret: process.env.FOO_COOKIE_SECRET,
  resave: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));
```

Advanced example showing some custom options:

```javascript
const postgres = require('postgres');
const expressSession = require('express-session');
const PostgresStore = require('connect-postgres-simple')(expressSession);

const sql = postgres({
    // Insert postgres options here
});

app.use(expressSession({
  store: new PostgresStore({
    postgres : sql,               // Template string tag from postgres
    tableName : 'user_sessions'   // Use another table-name than the default "session" one
    // Insert connect-postgres-simple options here
  }),
  secret: process.env.FOO_COOKIE_SECRET,
  resave: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));
```

## Advanced options


### Connection options

* **postgres** - sql template string tag provided by `postgres` to be used for DB communications.

### Other options

* **ttl** - the time to live for the session in the database – specified in seconds. Defaults to the cookie maxAge if the cookie has a maxAge defined and otherwise defaults to one day.
* **createTableIfMissing** - if set to `true` then creates the table in the case where the table does not already exist. Defaults to `false`.
* **disableTouch** – boolean value that if set to `true` disables the updating of TTL in the database when using touch. Defaults to false.
* **schemaName** - if your session table is in another Postgres schema than the default (it normally isn't), then you can specify that here.
* **tableName** - if your session table is named something else than `session`, then you can specify that here.
* **pruneSessionInterval** - sets the delay in seconds at which expired sessions are pruned from the database. Default is `60` seconds. If set to `false` no automatic pruning will happen. By default every delay is randomized between 50% and 150% of set value, resulting in an average delay equal to the set value, but spread out to even the load on the database. Automatic pruning will happen `pruneSessionInterval` seconds after the last pruning (includes manual prunes).
* **pruneSessionRandomizedInterval** – if set to `false`, then the exact value of `pruneSessionInterval` will be used in all delays. No randomization will happen. If multiple instances all start at once, disabling randomization can mean that multiple instances are all triggering pruning at once, causing unnecessary load on the database. Can also be set to a method, taking a numeric `delay` parameter and returning a modified one, thus allowing a custom delay algorithm if wanted.
* **errorLog** – the method used to log errors in those cases where an error can't be returned to a callback. Defaults to `console.error()`, but can be useful to override if one eg. uses [Bunyan](https://github.com/trentm/node-bunyan) for logging.

## Useful methods

* **close()** – if this module used its own database module to connect to Postgres, then this will shut that connection down to allow a graceful shutdown. Returns a `Promise` that will resolve when the database has shut down.
* **pruneSessions([callback(err)])** – will prune old sessions. Only really needed to be called if **pruneSessionInterval** has been set to `false` – which can be useful if one wants improved control of the pruning.

## License

[The MIT license](./LICENSE)

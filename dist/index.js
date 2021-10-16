'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const delayUnref = (duration) => new Promise(res => setTimeout(res, duration).unref());
var index = ({ Store }) => class PostgresStore extends Store {
    constructor(options = {}) {
        var _a, _b, _c, _d, _e, _f;
        super(options);
        this.tableCreationPromise = null;
        this.closed = false;
        this.postgres = (_a = options.postgres) !== null && _a !== void 0 ? _a : require('postgres')();
        this.tableName = (_b = options.tableName) !== null && _b !== void 0 ? _b : 'session';
        if (options.schemaName !== undefined)
            this.tableName = `${options.schemaName}.${this.tableName}`;
        this.ttl = (_c = options.ttl) !== null && _c !== void 0 ? _c : 86400; // One day by default
        this.tableCreationPromise = !options.createTableIfMissing
            ? Promise.resolve() // disable lazy-loading
            : null;
        this.disableTouch = (_d = options.disableTouch) !== null && _d !== void 0 ? _d : false;
        if (options.pruneSessionInterval !== false)
            (async (interval, randomize, errorLog) => {
                while (!this.closed) {
                    try {
                        await delayUnref(randomize(interval));
                        if (!this.closed)
                            await this.pruneSessions();
                    }
                    catch (err) {
                        errorLog('Failed to prune sessions:', err);
                    }
                }
            })(
            // interval
            ((_e = options.pruneSessionInterval) !== null && _e !== void 0 ? _e : 60 * 15) * 1000, 
            // randomize
            options.pruneSessionRandomizedInterval !== false ? options.pruneSessionRandomizedInterval !== undefined
                ? options.pruneSessionRandomizedInterval // user-provided randomizer
                : ((delay) => Math.ceil(delay / 2 + delay * Math.random())) // default randomizer
                : ((delay) => delay), // no randomizer
            // errorLog
            (_f = options.errorLog) !== null && _f !== void 0 ? _f : console.error.bind(console));
    }
    async beforeDatabaseAccess() {
        if (this.closed)
            throw new Error('Store closed by the user');
        // only true when `options.createTableIfMissing` is true and
        // this is the first call to `createTableIfNeeded()`
        if (this.tableCreationPromise === null)
            this.tableCreationPromise =
                this.postgres `SELECT to_regclass(${this.tableName}::text) AS result`
                    .catch(() => [{ result: null }])
                    .then(async ([{ result }]) => {
                    if (result !== null) // table exists
                        return;
                    // we cannot use `this.postgres.file` here because
                    // the table name must match `this.tableName`
                    // we use .. because this code will be compiled
                    // to /dist/index.js but we need /table.sql 
                    const tableFile = require('path').resolve(__dirname, '../table.sql');
                    const escapedTableName = this.tableName
                        .replace(/"/g, '""')
                        .replace(/^([^"]+)""\.""([^"]+)$/, '$1"."$2');
                    const createTable = await require('fs').promises.readFile(tableFile, 'utf8');
                    await this.postgres.unsafe(createTable
                        .replace(/"session"/g, escapedTableName));
                });
        await this.tableCreationPromise;
    }
    getExpireTime(sess) {
        var _a, _b;
        return new Date(Math.ceil(((_b = (_a = sess === null || sess === void 0 ? void 0 : sess.cookie) === null || _a === void 0 ? void 0 : _a.expires) !== null && _b !== void 0 ? _b : new Date(Date.now() + this.ttl * 1000)).getTime() / 1000) * 1000);
    }
    async pruneSessions(callback = () => { }) {
        const now = new Date(Math.ceil(Date.now() / 1000) * 1000);
        try {
            await this.beforeDatabaseAccess();
            await this.postgres `
        DELETE FROM ${this.postgres(this.tableName)}
        WHERE expire < ${now}
      `;
            callback();
        }
        catch (err) {
            callback(err);
        }
    }
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        await this.postgres.end();
    }
    async get(sid, callback) {
        try {
            await this.beforeDatabaseAccess();
            const [{ sess } = { sess: null }] = await this.postgres `
        SELECT sess
        FROM ${this.postgres(this.tableName)}
        WHERE sid = ${sid}
      `;
            callback(null, sess);
        }
        catch (err) {
            callback(err);
        }
    }
    async set(sid, session, callback) {
        try {
            await this.beforeDatabaseAccess();
            const sess = this.postgres.json(session);
            const expire = this.getExpireTime(session);
            await this.postgres `
        INSERT INTO ${this.postgres(this.tableName)} (sess, expire, sid)
        VALUES (${sess}, ${expire}, ${sid})
        ON CONFLICT (sid) DO UPDATE
        SET sess = ${sess}, expire = ${expire}
      `;
            callback === null || callback === void 0 ? void 0 : callback();
        }
        catch (err) {
            callback === null || callback === void 0 ? void 0 : callback(err);
        }
    }
    async destroy(sid, callback) {
        try {
            await this.beforeDatabaseAccess();
            await this.postgres `
        DELETE FROM ${this.postgres(this.tableName)}
        WHERE sid = ${sid}
      `;
            callback === null || callback === void 0 ? void 0 : callback();
        }
        catch (err) {
            callback === null || callback === void 0 ? void 0 : callback(err);
        }
    }
    async all(callback) {
        try {
            await this.beforeDatabaseAccess();
            const sessions = [];
            await this.postgres `
        SELECT sess FROM ${this.postgres(this.tableName)}
      `
                .stream(({ sess }) => sessions.push(sess));
            callback(null, sessions);
        }
        catch (err) {
            callback(err);
        }
    }
    async length(callback) {
        try {
            await this.beforeDatabaseAccess();
            const [{ length }] = await this.postgres `
        SELECT COUNT(sid) AS length
        FROM ${this.postgres(this.tableName)}
      `;
            callback(null, length);
        }
        catch (err) {
            callback(err, 0);
        }
    }
    async clear(callback) {
        try {
            await this.beforeDatabaseAccess();
            await this.postgres `
        DELETE FROM ${this.postgres(this.tableName)}
      `;
            callback === null || callback === void 0 ? void 0 : callback();
        }
        catch (err) {
            callback === null || callback === void 0 ? void 0 : callback(err);
        }
    }
    async touch(sid, session, callback) {
        if (!this.disableTouch)
            try {
                await this.beforeDatabaseAccess();
                // SET expire = ${new Date((Math.ceil(Date.now() / 1000) + this.ttl) * 1000)}
                const res = await this.postgres `
          UPDATE ${this.postgres(this.tableName)}
          SET expire = ${this.getExpireTime(session)}
          WHERE sid = ${sid}
        `;
            }
            catch (err) { }
        callback === null || callback === void 0 ? void 0 : callback();
    }
};

exports["default"] = index;
//# sourceMappingURL=index.js.map

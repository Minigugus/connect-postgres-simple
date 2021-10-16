// @ts-check

const express = require('express');
const session = require('express-session');

const postgres = require('postgres');

const PostgresStore = require('.')(session);

const app = express();

app.use(session({
  secret: 'wtf',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000
  },
  store: new PostgresStore({
    postgres: postgres(),
    createTableIfMissing: true,
    pruneSessionInterval: 10
  })
}));

app.get('/hello', (req, res) => res.status(200).json({
  session: req.session
}));

app.post('/hello', express.json(), (req, res) => res.status(200).json({
  session: Object.assign(req.session, req.body)
}));

app.listen(3000);

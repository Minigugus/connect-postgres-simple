-- FROM github.com/voxpelli/node-connect-pg-simple/blob/5398353c0db88a3c6e43e4a7d63f3c40a9d7f296/table.sql

BEGIN;

CREATE TABLE "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
	"sess" JSON NOT NULL,
	"expire" TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session"
  ADD CONSTRAINT "session_pkey"
    PRIMARY KEY ("sid")
    NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire"
  ON "session" ("expire");

COMMIT;

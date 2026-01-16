CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ
);

CREATE TABLE postes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL,
  team INTEGER NOT NULL
);

CREATE TABLE stock_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  expected INTEGER NOT NULL,
  available INTEGER NOT NULL,
  status TEXT NOT NULL
);

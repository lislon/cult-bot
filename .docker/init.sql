-- create database
CREATE DATABASE cult;

-- connect to database
\connect cult

-- create schema
CREATE SCHEMA be;

CREATE USER be_user WITH password 'be_user';

ALTER USER be_user WITH SUPERUSER;

GRANT USAGE ON SCHEMA be TO be_user;

ALTER SCHEMA be OWNER TO be_user;

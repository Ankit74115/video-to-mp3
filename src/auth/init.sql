-- Schema reference only. The auth service creates this table on startup
-- (CREATE TABLE IF NOT EXISTS) and seeds the demo user from DEMO_USER_EMAIL /
-- DEMO_USER_PASSWORD with a bcrypt hash, so no plaintext passwords live here.
--
-- With the official mysql Docker image, the database and the app user are
-- created automatically from MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD.

CREATE DATABASE IF NOT EXISTS auth;
USE auth;

CREATE TABLE IF NOT EXISTS user (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

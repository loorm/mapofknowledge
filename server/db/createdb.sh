#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: this script connects to the database as root over the local socket." >&2
  echo "Re-run it as root:  sudo $0" >&2
  exit 1
fi

DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="mapofknowledge"
DB_USER="mapofknowledge"

read -rp "Password for DB user '${DB_USER}' (from .env DB_PASS): " DB_PASS
[ -n "$DB_PASS" ] || { echo "ERROR: password cannot be empty." >&2; exit 1; }

if   command -v mariadb >/dev/null 2>&1; then CLIENT=mariadb
elif command -v mysql   >/dev/null 2>&1; then CLIENT=mysql
else echo "ERROR: no 'mariadb' or 'mysql' client found in PATH." >&2; exit 1
fi

echo "Creating database + user:"
echo "  host:     $DB_HOST:$DB_PORT"
echo "  database: $DB_NAME"
echo "  app user: $DB_USER  (@'localhost' and @'%')"
echo

"$CLIENT" --user=root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%'         IDENTIFIED BY '${DB_PASS}';
ALTER  USER              '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER  USER              '${DB_USER}'@'%'         IDENTIFIED BY '${DB_PASS}';

GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL

echo "✓ Database '${DB_NAME}' and user '${DB_USER}' are ready."

if "$CLIENT" --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASS" \
     --execute="USE \`${DB_NAME}\`; SELECT 1;" >/dev/null 2>&1; then
  echo "✓ Verified: app user can connect to '${DB_NAME}'."
else
  echo "! Warning: could not connect as '${DB_USER}' — check the password you entered." >&2
fi
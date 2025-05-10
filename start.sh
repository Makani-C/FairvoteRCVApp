#!/bin/bash
set -e

echo "Checking DATABASE_URL format..."
if [[ $DATABASE_URL == postgres://* ]]; then
  echo "Converting postgres:// to postgresql:// in DATABASE_URL"
  export DATABASE_URL=${DATABASE_URL/postgres:/postgresql:}
fi

echo "Waiting for database to be ready..."
python - <<EOF
import time
import sys
import psycopg2
from urllib.parse import urlparse

# Parse the database URL
db_url = urlparse("$DATABASE_URL")
dbname = db_url.path[1:]
user = db_url.username
password = db_url.password
host = db_url.hostname
port = db_url.port or 5432

# Try to connect to the database
max_retries = 30
retries = 0
while retries < max_retries:
    try:
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.close()
        print("Database is ready!")
        break
    except psycopg2.OperationalError as e:
        retries += 1
        print(f"Database not ready yet ({retries}/{max_retries}). Retrying in 1 second...")
        time.sleep(1)
else:
    print("Could not connect to the database after maximum retries")
    sys.exit(1)
EOF

exec uvicorn main:app --host 0.0.0.0 --port 8000
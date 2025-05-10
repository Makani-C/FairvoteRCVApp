#!/bin/bash
set -e

# Add  migration commands here if needed

exec uvicorn main:app --host 0.0.0.0 --port 8000
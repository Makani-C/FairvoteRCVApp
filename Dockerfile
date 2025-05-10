FROM python:3.9

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

COPY ./app /app

CMD uvicorn main:app --host 0.0.0.0 --port 8000
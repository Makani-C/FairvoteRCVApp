FROM python:3.9

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

COPY ./app /app

COPY start.sh .
RUN chmod +x start.sh
CMD ["./start.sh"]
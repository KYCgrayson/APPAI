FROM python:3.11-slim

RUN pip install --no-cache-dir fastapi uvicorn yt-dlp

WORKDIR /app
COPY main.py .
RUN mkdir -p /tmp/downloads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

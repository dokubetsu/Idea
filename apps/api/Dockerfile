FROM python:3.12-slim

WORKDIR /app

# Create a non-root system user for runtime security
RUN groupadd -g 999 appuser && \
    useradd -r -u 999 -g appuser appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Grant ownership of files to appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Portable Python healthcheck requesting local API status
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

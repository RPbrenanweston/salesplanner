# Backend Dockerfile for Railway deployment
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway sets $PORT dynamically)
EXPOSE 8000

# Run uvicorn with Railway's dynamic port
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

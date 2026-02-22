FROM python:3.11-slim

# Install Node.js for building the React frontend
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all files
COPY . .

# Build React frontend
RUN cd UI1 && npm install --include=dev && npm run build && cd ..

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Hugging Face Spaces uses port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["gunicorn", "app:app", "--workers", "1", "--threads", "4", "--timeout", "180", "--bind", "0.0.0.0:7860"]

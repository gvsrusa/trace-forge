FROM python:3.12-slim

# Node.js for Phoenix MCP server (npx @arizeai/phoenix-mcp)
RUN apt-get update && apt-get install -y nodejs npm curl && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install deps with locked versions (cache-friendly layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

# Copy source — .dockerignore excludes .env and __pycache__
COPY . .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]

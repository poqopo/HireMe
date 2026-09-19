FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY github_mcp/ /app/github_mcp/
COPY hireme_agent/ /app/hireme_agent/
COPY agents/ /app/agents/
RUN uv sync --frozen --no-dev --project /app/hireme_agent
ENV HIREME_AGENTS_ROOT=/app/agents \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["/app/hireme_agent/.venv/bin/hireme-agent-api", "--host", "0.0.0.0", "--port", "8000"]

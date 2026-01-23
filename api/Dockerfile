FROM python:3.12-bookworm
ARG DCC_ENV=dev
# Optimise python and debian in docker
ENV PYTHONUNBUFFERED 1
ENV PIP_BREAK_SYSTEM_PACKAGES 1
ENV PIP_DISABLE_PIP_VERSION_CHECK 1
ENV DEBIAN_FRONTEND noninteractive

# Create the required directories
RUN mkdir -p /app
RUN mkdir -p /vol/web/media
RUN mkdir -p /vol/web/static
RUN mkdir -p /vol/backups

# Update the package cache
RUN apt-get update --fix-missing

# Install PostgreSQL client
RUN apt-get install -y postgresql-client

# Cleanup
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install uv

# Copy pyproject.toml for dependency installation
COPY ./pyproject.toml /app/

# Install dependencies using uv
RUN if [ "$DCC_ENV" = "dev" ]; then \
    uv pip install --system -e "/app[dev]"; \
else \
    uv pip install --system -e "/app"; \
fi

# Set working directory
WORKDIR /app

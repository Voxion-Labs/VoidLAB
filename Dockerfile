# ==============================================================================
# VoidLAB God Image - Multi-Language Ephemeral Cloud IDE & Compiler Engine
# Ubuntu 22.04 LTS Runtime with Pre-Installed Compilers & Runtimes (Render Free Tier)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder - Build the Go server binary and WebAssembly client engine
# ------------------------------------------------------------------------------
FROM golang:1.23-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git make && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN make build wasm

# ------------------------------------------------------------------------------
# Stage 2: God Image Runtime - Comprehensive Multi-Language Compiler Environment
# ------------------------------------------------------------------------------
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=8080

# Install compilers and runtimes for all supported languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
    gcc \
    g++ \
    gdb \
    make \
    python3 \
    python3-pip \
    python3-dev \
    nodejs \
    npm \
    openjdk-17-jdk-headless \
    rustc \
    cargo \
    php-cli \
    ruby \
    ruby-dev \
    lua5.4 \
    sqlite3 \
    tzdata \
    && npm install -g tsx \
    && rm -rf /var/lib/apt/lists/*

# Copy modern Go 1.23 toolchain from builder stage
COPY --from=builder /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /app

# Ensure binary is accessible at both /app/voidlab and /app/bin/voidlab
COPY --from=builder /app/bin/voidlab /app/bin/voidlab
RUN ln -s /app/bin/voidlab /app/voidlab

# Copy web templates and static assets
COPY --from=builder /app/web/templates /app/web/templates
COPY --from=builder /app/public /app/public

# Expose Render standard port
EXPOSE 8080

# Default entrypoint runs the VoidLAB engine server
ENTRYPOINT ["/app/voidlab"]

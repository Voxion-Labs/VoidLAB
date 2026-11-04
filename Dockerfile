# ==============================================================================
# VoidLAB Multi-Stage Production Container
# High-Performance Cloud Code Editor & Ephemeral Execution Engine
# ==============================================================================

# Stage 1: Build the Go binary and WebAssembly client engine
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git make

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN make build wasm

# Stage 2: Minimalist, secure Alpine runtime environment
FROM alpine:3.19

# Install ca-certificates, docker-cli (for orchestrator execution), and timezone data
RUN apk add --no-cache ca-certificates docker-cli tzdata

WORKDIR /app

# Ensure binary is accessible at both /app/voidlab and /app/bin/voidlab
COPY --from=builder /app/bin/voidlab /app/bin/voidlab
RUN ln -s /app/bin/voidlab /app/voidlab

# Copy static assets and template fragments
COPY --from=builder /app/web/templates /app/web/templates
COPY --from=builder /app/public /app/public

# Expose Render standard HTTP port
EXPOSE 8080

ENV PORT=8080

ENTRYPOINT ["/app/voidlab"]

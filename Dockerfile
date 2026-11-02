# ==============================================================================
# VoidLAB Multi-Stage Production Container
# High-Performance Cloud Code Editor & Ephemeral Execution Engine
# ==============================================================================

# Stage 1: Build the Go binary and WebAssembly client engine
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git make

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN make build wasm

# Stage 2: Minimalist, secure Alpine runtime environment
FROM alpine:3.19

RUN apk add --no-cache ca-certificates docker-cli tzdata

WORKDIR /app

COPY --from=builder /app/bin/voidlab /app/voidlab
COPY --from=builder /app/web/templates /app/web/templates
COPY --from=builder /app/public /app/public

EXPOSE 8080

ENV PORT=8080

ENTRYPOINT ["/app/voidlab"]

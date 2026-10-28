# ==============================================================================
# VoidLAB Engine Makefile
# High-Performance Cloud Code Editor Engine (Go + HTMX + TailwindCSS + WASM)
# ==============================================================================

BINARY_NAME  ?= voidlab
BIN_DIR      ?= bin
ifeq ($(OS),Windows_NT)
    TARGET_BIN = $(BIN_DIR)/$(BINARY_NAME).exe
else
    TARGET_BIN = $(BIN_DIR)/$(BINARY_NAME)
endif
BENCH_OUTPUT ?= benchmarks.txt
COVER_OUTPUT ?= coverage.out
MAIN_PKG     ?= ./cmd/voidlab
TEST_PKG     ?= ./cmd/... ./internal/...
WASM_PKG     ?= ./cmd/wasm
WASM_OUTPUT  ?= public/wasm/voidlab.wasm

GO           ?= go
GOFLAGS      ?= -v
export CGO_ENABLED ?= 0
LDFLAGS      ?= -s -w

# OS-agnostic command resolution
ifeq ($(OS),Windows_NT)
    RM_CMD    = if exist $(BIN_DIR) rd /s /q $(BIN_DIR) 2>nul & if exist $(BENCH_OUTPUT) del /f /q $(BENCH_OUTPUT) 2>nul & if exist $(COVER_OUTPUT) del /f /q $(COVER_OUTPUT) 2>nul & exit 0
    PRINT_CMD = if exist $(BENCH_OUTPUT) type $(BENCH_OUTPUT)
else
    SHELL       := /bin/bash
    .SHELLFLAGS := -eu -o pipefail -c
    RM_CMD      = rm -rf $(BIN_DIR) $(BENCH_OUTPUT) $(COVER_OUTPUT)
    PRINT_CMD   = cat $(BENCH_OUTPUT)
endif

.PHONY: all build wasm clean test bench regression bot-rebase help

all: build wasm

## build: Compiles the VoidLAB server binary
build:
	@echo "==> Building $(BINARY_NAME)..."
	$(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o $(TARGET_BIN) $(MAIN_PKG)

## wasm: Compiles the Go WebAssembly client-side engine
wasm:
	@echo "==> Building WebAssembly module..."
ifeq ($(OS),Windows_NT)
	cmd.exe /c "set GOOS=js&& set GOARCH=wasm&& $(GO) build -ldflags=-s -o $(WASM_OUTPUT) $(WASM_PKG)"
else
	GOOS=js GOARCH=wasm $(GO) build -ldflags="-s -w" -o $(WASM_OUTPUT) $(WASM_PKG)
endif

## clean: Removes build artifacts, benchmarks, and coverage profiles
clean:
	@echo "==> Cleaning build artifacts and temporary files..."
	@$(RM_CMD)
	@$(GO) clean -testcache -cache

## test: Runs test suite with data race detection and coverage profile
test:
	@echo "==> Running test suite..."
	$(GO) test $(GOFLAGS) -cover -coverprofile=$(COVER_OUTPUT) $(TEST_PKG)

## bench: Executes benchmarks with memory allocations and writes metrics to file
bench:
	@echo "==> Executing performance benchmarks..."
	$(GO) test -run=none -bench=. -benchmem $(TEST_PKG) > $(BENCH_OUTPUT)
	@$(PRINT_CMD)

## regression: Critical testing protocol validating TS/JS -> Go API and behavior contracts
regression:
	@echo "==> Executing regression suite (contract & behavior parity validation)..."
	$(GO) test $(GOFLAGS) -tags=regression -run=TestRegression $(TEST_PKG)

## bot-rebase: Safe fetch, rebase on origin/main, and tidy Go module dependencies
bot-rebase:
	@echo "==> Executing safe bot rebase..."
	git fetch origin main
	git rebase origin/main
	$(GO) mod tidy

## help: Displays available targets with descriptions
help:
	@echo "VoidLAB Engine Build System"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build       Compiles the VoidLAB server binary"
	@echo "  wasm        Compiles the Go WebAssembly client-side engine"
	@echo "  clean       Removes build artifacts, benchmarks, and coverage profiles"
	@echo "  test        Runs test suite with coverage profile"
	@echo "  bench       Executes benchmarks and writes metrics to file"
	@echo "  regression  Validates contract and behavior parity"
	@echo "  bot-rebase  Safe fetch, rebase on origin/main, and tidy Go modules"

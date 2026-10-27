# ==============================================================================
# VoidLAB Engine Makefile
# High-Performance Cloud Code Editor Engine (Go + HTMX + TailwindCSS + WASM)
# ==============================================================================

SHELL        := /bin/bash
.SHELLFLAGS  := -eu -o pipefail -c

BINARY_NAME  ?= voidlab
BIN_DIR      ?= bin
BENCH_OUTPUT ?= benchmarks.txt
COVER_OUTPUT ?= coverage.out
PKG          ?= ./...

GO           ?= go
GOFLAGS      ?= -v
CGO_ENABLED  ?= 0
LDFLAGS      ?= -s -w

.PHONY: all build clean test bench regression bot-rebase help

all: build

## build: Compiles the VoidLAB server binary
build:
	@echo "==> Building $(BINARY_NAME)..."
	@mkdir -p $(BIN_DIR)
	CGO_ENABLED=$(CGO_ENABLED) $(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o $(BIN_DIR)/$(BINARY_NAME) $(if $(wildcard cmd/$(BINARY_NAME)),./cmd/$(BINARY_NAME),$(if $(wildcard main.go),.,./...))

## clean: Removes build artifacts, benchmarks, and coverage profiles
clean:
	@echo "==> Cleaning build artifacts and temporary files..."
	@rm -rf $(BIN_DIR) $(BENCH_OUTPUT) $(COVER_OUTPUT)
	@$(GO) clean -testcache -cache

## test: Runs test suite with data race detection and coverage profile
test:
	@echo "==> Running test suite..."
	$(GO) test $(GOFLAGS) -race -cover -coverprofile=$(COVER_OUTPUT) $(PKG)

## bench: Executes benchmarks with memory allocations and writes metrics to file
bench:
	@echo "==> Executing performance benchmarks..."
	@$(GO) test -run=^$$ -bench=. -benchmem $(PKG) > $(BENCH_OUTPUT)
	@cat $(BENCH_OUTPUT)

## regression: Critical testing protocol validating TS/JS -> Go API and behavior contracts
regression:
	@echo "==> Executing regression suite (contract & behavior parity validation)..."
	$(GO) test $(GOFLAGS) -tags=regression -run=TestRegression $(PKG)

## bot-rebase: Safe fetch, rebase on origin/main, and tidy Go module dependencies
bot-rebase:
	@echo "==> Executing safe bot rebase..."
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "ERROR: Working tree contains uncommitted changes. Stash or commit before rebasing." >&2; \
		exit 1; \
	fi
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
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
		helpMessage = match(lastLine, /^## (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")-1); \
			helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
			printf "  %-14s %s\n", helpCommand, helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

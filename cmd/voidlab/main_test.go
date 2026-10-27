package main

import (
	"testing"
)

func TestEngineInitialization(t *testing.T) {
	if err := run(); err != nil {
		t.Fatalf("expected run() to succeed, got %v", err)
	}
}

func BenchmarkVoidLABEngine(b *testing.B) {
	for i := 0; i < b.N; i++ {
		if err := run(); err != nil {
			b.Fatalf("benchmark iteration failed: %v", err)
		}
	}
}

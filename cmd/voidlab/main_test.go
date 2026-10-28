package main

import (
	"html/template"
	"path/filepath"
	"testing"
)

func TestEngineInitialization(t *testing.T) {
	if err := run(); err != nil {
		t.Fatalf("expected run() to succeed, got %v", err)
	}
}

func TestTemplateParsing(t *testing.T) {
	pattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	tmpl, err := template.ParseGlob(pattern)
	if err != nil {
		t.Fatalf("Failed to parse templates at %s: %v", pattern, err)
	}
	if tmpl == nil {
		t.Fatalf("Expected parsed template, got nil")
	}
}

func BenchmarkVoidLABEngine(b *testing.B) {
	for i := 0; i < b.N; i++ {
		if err := run(); err != nil {
			b.Fatalf("benchmark iteration failed: %v", err)
		}
	}
}

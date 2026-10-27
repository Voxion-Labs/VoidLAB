//go:build regression

package main

import (
	"testing"
)

// TestRegression executes contract and behavior validation ensuring 1:1 parity with the legacy stack.
func TestRegression(t *testing.T) {
	t.Log("Validating VoidLAB contract and behavioral parity against TypeScript specification...")
	if err := run(); err != nil {
		t.Fatalf("Regression contract assertion failed: %v", err)
	}
}

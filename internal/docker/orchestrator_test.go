package docker

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestOrchestratorLanguageDetection(t *testing.T) {
	tempDir := t.TempDir()
	orc, err := NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create orchestrator: %v", err)
	}

	tests := []struct {
		file     string
		expected string
	}{
		{"main.py", "python"},
		{"server.cpp", "cpp"},
		{"main.go", "go"},
		{"app.js", "javascript"},
		{"handler.ts", "typescript"},
		{"script.sh", "shell"},
		{"lib.rs", "rust"},
	}

	for _, tt := range tests {
		lang := orc.DetectLanguage(tt.file)
		if lang != tt.expected {
			t.Errorf("for file %s expected %s, got %s", tt.file, tt.expected, lang)
		}
	}
}

func TestOrchestratorPathSecurity(t *testing.T) {
	tempDir := t.TempDir()
	orc, err := NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create orchestrator: %v", err)
	}

	ctx := context.Background()
	var out bytes.Buffer

	// Attempt path traversal
	_, err = orc.Run(ctx, "../../etc/passwd", "python", nil, &out, &out)
	if err == nil {
		t.Errorf("expected security error when running path traversal target, got nil")
	}
}

func TestOrchestratorExecution(t *testing.T) {
	tempDir := t.TempDir()
	orc, err := NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create orchestrator: %v", err)
	}

	// Create test python file
	scriptPath := filepath.Join(tempDir, "test.py")
	scriptContent := "print('VOIDLAB_DOCKER_ENGINE_ONLINE')\n"
	if err := os.WriteFile(scriptPath, []byte(scriptContent), 0644); err != nil {
		t.Fatalf("failed to write test script: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var stdout, stderr bytes.Buffer
	result, err := orc.Run(ctx, "test.py", "python", nil, &stdout, &stderr)
	if err != nil {
		t.Logf("execution completed with error or notice: %v (stderr: %s)", err, stderr.String())
	}

	if result == nil {
		t.Fatalf("expected ExecutionResult, got nil")
	}

	outCombined := stdout.String() + stderr.String()
	if !strings.Contains(outCombined, "VOIDLAB_DOCKER_ENGINE_ONLINE") && !strings.Contains(outCombined, "Docker daemon not reachable") {
		t.Errorf("expected execution output to contain output or notice, got: %s", outCombined)
	}
}

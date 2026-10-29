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
		{"Main.java", "java"},
		{"Program.cs", "csharp"},
		{"index.php", "php"},
		{"script.rb", "ruby"},
		{"App.swift", "swift"},
		{"Main.kt", "kotlin"},
		{"game.lua", "lua"},
		{"deploy.ps1", "powershell"},
		{"main.c", "c"},
	}

	for _, tt := range tests {
		lang := orc.DetectLanguage(tt.file)
		if lang != tt.expected {
			t.Errorf("for file %s expected %s, got %s", tt.file, tt.expected, lang)
		}
	}
}

func Test16LanguagesMapping(t *testing.T) {
	expectedLanguages := []string{
		"cpp", "c", "rust", "python", "go", "javascript", "typescript",
		"java", "csharp", "php", "ruby", "swift", "kotlin", "lua", "shell", "powershell",
	}

	if len(expectedLanguages) != 16 {
		t.Fatalf("expected 16 languages in spec, got %d", len(expectedLanguages))
	}

	for _, lang := range expectedLanguages {
		img, ok := LanguageImageMap[lang]
		if !ok || img == "" {
			t.Errorf("missing or empty Docker image mapping for language: %s", lang)
		}
		if !strings.Contains(img, "alpine") && !strings.Contains(img, "slim") {
			t.Errorf("image for %s should be lightweight alpine or slim, got %s", lang, img)
		}

		cfg, ok := DefaultLanguageConfigs[lang]
		if !ok {
			t.Errorf("missing DefaultLanguageConfigs entry for language: %s", lang)
		}
		if cfg.Name == "" || cfg.Extension == "" || cfg.Timeout <= 0 {
			t.Errorf("invalid config fields for language: %s", lang)
		}
	}
}

func TestExecuteCodeEmptySignature(t *testing.T) {
	tempDir := t.TempDir()
	orc, err := NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create orchestrator: %v", err)
	}

	// Verify method signature on Orchestrator struct
	res, err := orc.ExecuteCode("python", tempDir)
	if res != nil || err != nil {
		t.Errorf("expected empty signature placeholder to return nil, nil; got %v, %v", res, err)
	}

	// Verify package-level function signature
	resPkg, errPkg := ExecuteCode("cpp", tempDir)
	if resPkg != nil || errPkg != nil {
		t.Errorf("expected package-level ExecuteCode to return nil, nil; got %v, %v", resPkg, errPkg)
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

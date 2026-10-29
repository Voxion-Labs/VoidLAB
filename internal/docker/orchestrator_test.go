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

func TestBuildDockerArgsSecurityLimits(t *testing.T) {
	tempDir := t.TempDir()
	cmdSlice := []string{"python", "-u", "main.py"}
	args := BuildDockerArgs("python:3.11-alpine", tempDir, cmdSlice)

	joined := strings.Join(args, " ")
	if !strings.Contains(joined, "--rm") {
		t.Errorf("BuildDockerArgs missing --rm flag: %s", joined)
	}
	if !strings.Contains(joined, "--memory=256m") {
		t.Errorf("BuildDockerArgs missing strict memory limit --memory=256m: %s", joined)
	}
	if !strings.Contains(joined, "--cpus=0.5") {
		t.Errorf("BuildDockerArgs missing strict CPU limit --cpus=0.5: %s", joined)
	}
	if !strings.Contains(joined, ":/workspace:rw") {
		t.Errorf("BuildDockerArgs missing secure volume mount :/workspace:rw: %s", joined)
	}
	if !strings.Contains(joined, "-w /workspace") {
		t.Errorf("BuildDockerArgs missing working dir -w /workspace: %s", joined)
	}
}

func TestExecuteCodeResourceLimitsAndExecution(t *testing.T) {
	tempDir := t.TempDir()
	pyFile := filepath.Join(tempDir, "main.py")
	if err := os.WriteFile(pyFile, []byte("print('voidlab-execution-success')\n"), 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	orc, err := NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create orchestrator: %v", err)
	}

	// Verify method execution on Orchestrator
	res, err := orc.ExecuteCode("python", tempDir)
	if err != nil {
		t.Fatalf("ExecuteCode returned unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("ExecuteCode returned nil result")
	}
	if res.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d. stderr: %s", res.ExitCode, res.Stderr)
	}
	if !strings.Contains(res.Stdout, "voidlab-execution-success") {
		t.Errorf("expected stdout to contain 'voidlab-execution-success', got: %q", res.Stdout)
	}

	// Verify package-level function execution
	resPkg, errPkg := ExecuteCode("python", tempDir)
	if errPkg != nil {
		t.Fatalf("package-level ExecuteCode returned error: %v", errPkg)
	}
	if resPkg == nil || resPkg.ExitCode != 0 {
		t.Fatalf("package-level ExecuteCode failed: %v", resPkg)
	}
	if !strings.Contains(resPkg.Stdout, "voidlab-execution-success") {
		t.Errorf("expected package-level stdout to contain output, got: %q", resPkg.Stdout)
	}
}

func TestExtendedLanguagesSupport(t *testing.T) {
	languages := []string{"sql", "html", "css", "markdown", "json", "yaml", "xml"}
	for _, l := range languages {
		if _, ok := LanguageImageMap[l]; !ok {
			t.Errorf("missing LanguageImageMap entry for %s", l)
		}
		if _, ok := DefaultLanguageConfigs[l]; !ok {
			t.Errorf("missing DefaultLanguageConfigs entry for %s", l)
		}
	}

	tempDir := t.TempDir()
	orc, _ := NewOrchestrator(tempDir)

	if orc.DetectLanguage("index.html") != "html" {
		t.Errorf("expected html detection, got %s", orc.DetectLanguage("index.html"))
	}
	if orc.DetectLanguage("style.css") != "css" {
		t.Errorf("expected css detection, got %s", orc.DetectLanguage("style.css"))
	}
	if orc.DetectLanguage("query.sql") != "sql" {
		t.Errorf("expected sql detection, got %s", orc.DetectLanguage("query.sql"))
	}
	if NormalizeLanguage("sqlite3") != "sql" {
		t.Errorf("expected sql normalization for sqlite3, got %s", NormalizeLanguage("sqlite3"))
	}
	if NormalizeLanguage("htm") != "html" {
		t.Errorf("expected html normalization for htm, got %s", NormalizeLanguage("htm"))
	}
}

func TestExecuteCodeHTMLAndCSS(t *testing.T) {
	tempDir := t.TempDir()
	orc, _ := NewOrchestrator(tempDir)

	htmlContent := "<!DOCTYPE html><html><body><h1>VoidLAB Live Preview</h1></body></html>"
	_ = os.WriteFile(filepath.Join(tempDir, "index.html"), []byte(htmlContent), 0644)

	res, err := orc.ExecuteCode("html", tempDir)
	if err != nil {
		t.Fatalf("ExecuteCode(html) failed: %v", err)
	}
	if !strings.Contains(res.Stdout, "VoidLAB Live Preview") {
		t.Errorf("expected html stdout to contain content, got: %s", res.Stdout)
	}

	cssContent := "body { background: #000; color: #fff; }"
	_ = os.WriteFile(filepath.Join(tempDir, "style.css"), []byte(cssContent), 0644)

	resCSS, errCSS := orc.ExecuteCode("css", tempDir)
	if errCSS != nil {
		t.Fatalf("ExecuteCode(css) failed: %v", errCSS)
	}
	if !strings.Contains(resCSS.Stdout, "background: #000") {
		t.Errorf("expected css stdout to contain content, got: %s", resCSS.Stdout)
	}
}

func TestExecuteCodeSQL(t *testing.T) {
	tempDir := t.TempDir()
	orc, _ := NewOrchestrator(tempDir)

	sqlContent := "SELECT 100 + 42;"
	_ = os.WriteFile(filepath.Join(tempDir, "main.sql"), []byte(sqlContent), 0644)

	res, err := orc.ExecuteCode("sql", tempDir)
	if err != nil {
		t.Fatalf("ExecuteCode(sql) failed: %v", err)
	}
	if res.ExitCode != 0 {
		t.Errorf("expected exit code 0 for sql execution, got %d, stderr: %s", res.ExitCode, res.Stderr)
	}
	if !strings.Contains(res.Stdout, "142") {
		t.Errorf("expected sql result 142 in stdout, got: %s", res.Stdout)
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

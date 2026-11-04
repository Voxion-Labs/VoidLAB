package docker

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	// DefaultExecutionTimeout is strictly enforced to eliminate infinite loops and resource leaks.
	DefaultExecutionTimeout = 5 * time.Second
)

var isWindows = runtime.GOOS == "windows"

func exeSuffix(name string) string {
	if isWindows {
		return name + ".exe"
	}
	return name
}

// LanguageConfig defines container metadata, default extensions, and resource ceilings for a language.
type LanguageConfig struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Image       string        `json:"image"`        // Kept for backward compatibility
	Extension   string        `json:"extension"`    // Standard file extension
	CompileCmd  string        `json:"compile_cmd"`  // Compilation command (empty for interpreted languages)
	RunCmd      string        `json:"run_cmd"`      // Execution command
	Timeout     time.Duration `json:"timeout"`
	MemoryLimit string        `json:"memory_limit"` // e.g. "256m"
	CPULimit    string        `json:"cpu_limit"`    // e.g. "0.5"
}

// ExecutionRequest encapsulates code execution parameters across supported runtimes.
type ExecutionRequest struct {
	Language      string        `json:"language"`
	WorkspacePath string        `json:"workspace_path"`
	EntryFile     string        `json:"entry_file,omitempty"`
	Stdin         io.Reader     `json:"-"`
	Stdout        io.Writer     `json:"-"`
	Stderr        io.Writer     `json:"-"`
	Timeout       time.Duration `json:"timeout,omitempty"`
}

// LanguageProfile defines language name, compilation, and execution metadata per language.
type LanguageProfile struct {
	Name        string
	Image       string
	Command     func(containerFilePath string) []string
	Timeout     time.Duration
	MemoryLimit string
	CPULimit    string
}

// ExecutionResult captures runtime metrics and completion status.
type ExecutionResult struct {
	Language string        `json:"language"`
	Image    string        `json:"image"`
	Duration time.Duration `json:"duration"`
	ExitCode int           `json:"exit_code"`
	IsDocker bool          `json:"is_docker"`
	Stdout   string        `json:"stdout"`
	Stderr   string        `json:"stderr"`
}

// LanguageImageMap provides metadata image mappings for supported languages.
var LanguageImageMap = map[string]string{
	"cpp":        "gcc:alpine",
	"c":          "gcc:alpine",
	"rust":       "rust:alpine",
	"python":     "python:3.11-alpine",
	"go":         "golang:1.23-alpine",
	"javascript": "node:20-alpine",
	"typescript": "node:20-alpine",
	"java":       "eclipse-temurin:21-alpine",
	"csharp":     "mcr.microsoft.com/dotnet/sdk:8.0-alpine",
	"php":        "php:8.3-alpine",
	"ruby":       "ruby:3.2-alpine",
	"swift":      "swift:slim",
	"kotlin":     "amazoncorretto:21-alpine",
	"lua":        "nickblah/lua:5.4-alpine",
	"shell":      "alpine:latest",
	"powershell": "mcr.microsoft.com/powershell:lts-alpine",
	"sql":        "alpine:latest",
	"html":       "alpine:latest",
	"css":        "alpine:latest",
	"markdown":   "alpine:latest",
	"json":       "alpine:latest",
	"yaml":       "alpine:latest",
	"xml":        "alpine:latest",
}

// DefaultLanguageConfigs provides metadata and execution configurations for all 16 supported runtimes.
var DefaultLanguageConfigs = map[string]LanguageConfig{
	"cpp": {
		ID:          "cpp",
		Name:        "C++",
		Image:       "gcc:alpine",
		Extension:   ".cpp",
		CompileCmd:  "g++ -O2 -Wall main.cpp -o app",
		RunCmd:      "./app",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"c": {
		ID:          "c",
		Name:        "C",
		Image:       "gcc:alpine",
		Extension:   ".c",
		CompileCmd:  "gcc -O2 -Wall main.c -o app",
		RunCmd:      "./app",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"rust": {
		ID:          "rust",
		Name:        "Rust",
		Image:       "rust:alpine",
		Extension:   ".rs",
		CompileCmd:  "rustc main.rs -o app",
		RunCmd:      "./app",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"python": {
		ID:          "python",
		Name:        "Python",
		Image:       "python:3.11-alpine",
		Extension:   ".py",
		CompileCmd:  "",
		RunCmd:      "python -u main.py",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"go": {
		ID:          "go",
		Name:        "Go",
		Image:       "golang:1.23-alpine",
		Extension:   ".go",
		CompileCmd:  "",
		RunCmd:      "go run main.go",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"javascript": {
		ID:          "javascript",
		Name:        "JavaScript",
		Image:       "node:20-alpine",
		Extension:   ".js",
		CompileCmd:  "",
		RunCmd:      "node main.js",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"typescript": {
		ID:          "typescript",
		Name:        "TypeScript",
		Image:       "node:20-alpine",
		Extension:   ".ts",
		CompileCmd:  "",
		RunCmd:      "npx tsx main.ts",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"java": {
		ID:          "java",
		Name:        "Java",
		Image:       "eclipse-temurin:21-alpine",
		Extension:   ".java",
		CompileCmd:  "javac Main.java",
		RunCmd:      "java Main",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"csharp": {
		ID:          "csharp",
		Name:        "C#",
		Image:       "mcr.microsoft.com/dotnet/sdk:8.0-alpine",
		Extension:   ".cs",
		CompileCmd:  "dotnet build",
		RunCmd:      "dotnet run",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"php": {
		ID:          "php",
		Name:        "PHP",
		Image:       "php:8.3-alpine",
		Extension:   ".php",
		CompileCmd:  "",
		RunCmd:      "php main.php",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"ruby": {
		ID:          "ruby",
		Name:        "Ruby",
		Image:       "ruby:3.2-alpine",
		Extension:   ".rb",
		CompileCmd:  "",
		RunCmd:      "ruby main.rb",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"swift": {
		ID:          "swift",
		Name:        "Swift",
		Image:       "swift:slim",
		Extension:   ".swift",
		CompileCmd:  "swiftc main.swift -o app",
		RunCmd:      "./app",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"kotlin": {
		ID:          "kotlin",
		Name:        "Kotlin",
		Image:       "amazoncorretto:21-alpine",
		Extension:   ".kt",
		CompileCmd:  "kotlinc main.kt -include-runtime -d app.jar",
		RunCmd:      "java -jar app.jar",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"lua": {
		ID:          "lua",
		Name:        "Lua",
		Image:       "nickblah/lua:5.4-alpine",
		Extension:   ".lua",
		CompileCmd:  "",
		RunCmd:      "lua main.lua",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"shell": {
		ID:          "shell",
		Name:        "Shell",
		Image:       "alpine:latest",
		Extension:   ".sh",
		CompileCmd:  "",
		RunCmd:      "sh main.sh",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"powershell": {
		ID:          "powershell",
		Name:        "PowerShell",
		Image:       "mcr.microsoft.com/powershell:lts-alpine",
		Extension:   ".ps1",
		CompileCmd:  "",
		RunCmd:      "pwsh -File main.ps1",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"sql": {
		ID:          "sql",
		Name:        "SQL",
		Image:       "alpine:latest",
		Extension:   ".sql",
		CompileCmd:  "",
		RunCmd:      "sqlite3 :memory: < main.sql",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"html": {
		ID:          "html",
		Name:        "HTML",
		Image:       "alpine:latest",
		Extension:   ".html",
		CompileCmd:  "",
		RunCmd:      "cat index.html",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"css": {
		ID:          "css",
		Name:        "CSS",
		Image:       "alpine:latest",
		Extension:   ".css",
		CompileCmd:  "",
		RunCmd:      "cat style.css",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"markdown": {
		ID:          "markdown",
		Name:        "Markdown",
		Image:       "alpine:latest",
		Extension:   ".md",
		CompileCmd:  "",
		RunCmd:      "cat README.md",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"json": {
		ID:          "json",
		Name:        "JSON",
		Image:       "alpine:latest",
		Extension:   ".json",
		CompileCmd:  "",
		RunCmd:      "cat data.json",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"yaml": {
		ID:          "yaml",
		Name:        "YAML",
		Image:       "alpine:latest",
		Extension:   ".yml",
		CompileCmd:  "",
		RunCmd:      "cat config.yml",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
	"xml": {
		ID:          "xml",
		Name:        "XML",
		Image:       "alpine:latest",
		Extension:   ".xml",
		CompileCmd:  "",
		RunCmd:      "cat data.xml",
		Timeout:     DefaultExecutionTimeout,
		MemoryLimit: "256m",
		CPULimit:    "0.5",
	},
}

// Orchestrator manages code execution in isolated temporary environments using host binaries.
type Orchestrator struct {
	workspaceDir string
	profiles     map[string]LanguageProfile
	configs      map[string]LanguageConfig
}

// NewOrchestrator initializes the God Image execution engine.
func NewOrchestrator(workspaceDir string) (*Orchestrator, error) {
	absWorkspace, err := filepath.Abs(workspaceDir)
	if err != nil {
		return nil, fmt.Errorf("invalid workspace directory: %w", err)
	}

	orc := &Orchestrator{
		workspaceDir: absWorkspace,
		profiles:     make(map[string]LanguageProfile),
		configs:      DefaultLanguageConfigs,
	}

	orc.initProfiles()
	return orc, nil
}

// BuildDockerArgs constructs CLI arguments for backward compatibility.
func BuildDockerArgs(image string, absWorkspace string, command []string) []string {
	args := []string{
		"run",
		"--rm",
		"--memory=256m",
		"--cpus=0.5",
		"--pids-limit=64",
		"--security-opt=no-new-privileges",
		"-v", fmt.Sprintf("%s:/workspace:rw", filepath.ToSlash(absWorkspace)),
		"-w", "/workspace",
		image,
	}
	return append(args, command...)
}

// ExecuteCode runs code from workspacePath in an isolated temporary directory with a strict 5-second timeout.
func (o *Orchestrator) ExecuteCode(language string, workspacePath string) (*ExecutionResult, error) {
	return o.ExecuteCodeContext(context.Background(), language, workspacePath)
}

// ExecuteCodeContext provides context-aware code execution in an isolated temporary directory.
func (o *Orchestrator) ExecuteCodeContext(ctx context.Context, language string, workspacePath string) (*ExecutionResult, error) {
	if workspacePath == "" {
		workspacePath = o.workspaceDir
	}

	slashNormalized := strings.ReplaceAll(strings.TrimSpace(workspacePath), "\\", "/")
	if slashNormalized == ".." || strings.HasPrefix(slashNormalized, "../") || strings.Contains(slashNormalized, "/../") {
		return nil, errors.New("security error: path escapes workspace boundaries")
	}

	absPath, err := filepath.Abs(filepath.FromSlash(slashNormalized))
	if err != nil {
		return nil, fmt.Errorf("invalid workspacePath: %w", err)
	}

	stat, err := os.Stat(absPath)
	if err != nil {
		return nil, fmt.Errorf("workspacePath not found: %w", err)
	}

	var sourceDir string
	var entryFile string

	if stat.IsDir() {
		sourceDir = absPath
	} else {
		sourceDir = filepath.Dir(absPath)
		entryFile = filepath.Base(absPath)
	}

	normLang := NormalizeLanguage(language)
	cfg, ok := DefaultLanguageConfigs[normLang]
	if !ok {
		cfg = DefaultLanguageConfigs["python"]
	}

	if entryFile == "" {
		entryFile = o.findEntryFile(sourceDir, cfg)
	}

	var stdoutBuf bytes.Buffer
	var stderrBuf bytes.Buffer

	// Convert to relative path from workspace directory
	relPath, err := filepath.Rel(o.workspaceDir, filepath.Join(sourceDir, entryFile))
	if err != nil {
		relPath = entryFile
	}

	result, err := o.Run(ctx, relPath, normLang, nil, &stdoutBuf, &stderrBuf)
	if result != nil {
		result.Stdout = stdoutBuf.String()
		result.Stderr = stderrBuf.String()
	}

	return result, err
}

// ExecuteCode package-level entry point function executing user code directly with a 5-second timeout.
func ExecuteCode(language string, workspacePath string) (*ExecutionResult, error) {
	workDir := workspacePath
	if workDir == "" {
		workDir = "."
	}
	stat, err := os.Stat(workDir)
	if err == nil && !stat.IsDir() {
		workDir = filepath.Dir(workDir)
	}
	orc, err := NewOrchestrator(workDir)
	if err != nil {
		return nil, err
	}
	return orc.ExecuteCode(language, workspacePath)
}

func (o *Orchestrator) findEntryFile(dir string, cfg LanguageConfig) string {
	candidates := []string{
		"main" + cfg.Extension,
		"index" + cfg.Extension,
		"app" + cfg.Extension,
		"script" + cfg.Extension,
		"query" + cfg.Extension,
		"Main" + cfg.Extension,
		"Program" + cfg.Extension,
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(dir, c)); err == nil {
			return c
		}
	}

	entries, err := os.ReadDir(dir)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.EqualFold(filepath.Ext(e.Name()), cfg.Extension) {
				return e.Name()
			}
		}
	}

	return "main" + cfg.Extension
}

// findBin checks for any of the given binary names on system PATH and returns the first resolved path.
func findBin(names ...string) string {
	for _, n := range names {
		if p, err := exec.LookPath(n); err == nil {
			// On Windows, avoid dummy Microsoft Store execution alias stubs
			if isWindows && strings.Contains(strings.ToLower(p), "windowsapps") {
				continue
			}
			return p
		}
	}
	for _, n := range names {
		if p, err := exec.LookPath(n); err == nil {
			return p
		}
	}
	return ""
}

// createIsolatedWorkDir copies all source files into a dedicated temporary directory.
func createIsolatedWorkDir(sourceDir string, targetFile string) (string, string, error) {
	tmpDir, err := os.MkdirTemp("", "voidlab-run-*")
	if err != nil {
		return "", "", fmt.Errorf("failed to create isolated temp execution dir: %w", err)
	}

	// Copy directory contents to isolated environment
	_ = filepath.Walk(sourceDir, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(sourceDir, p)
		if err != nil || rel == "." {
			return nil
		}
		if info.IsDir() && strings.HasPrefix(info.Name(), ".") {
			return filepath.SkipDir
		}
		dest := filepath.Join(tmpDir, rel)
		if info.IsDir() {
			return os.MkdirAll(dest, 0755)
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return nil
		}
		return os.WriteFile(dest, data, info.Mode())
	})

	return tmpDir, filepath.Base(targetFile), nil
}

// IsDockerAvailable reports whether the execution engine is ready.
func (o *Orchestrator) IsDockerAvailable(ctx context.Context) bool {
	return false
}

// Run copies the user's code to an isolated temporary directory, executes it via standard OS binaries,
// and strictly enforces context.WithTimeout (5 seconds) to prevent infinite loops and resource exhaustion.
func (o *Orchestrator) Run(
	ctx context.Context,
	relPath string,
	lang string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
) (*ExecutionResult, error) {
	trimmed := strings.TrimSpace(relPath)
	slashNormalized := strings.ReplaceAll(trimmed, "\\", "/")
	if strings.HasPrefix(slashNormalized, "/") || (len(slashNormalized) > 1 && slashNormalized[1] == ':') {
		return nil, errors.New("security error: path escapes workspace boundaries")
	}
	cleanedSlash := path.Clean(slashNormalized)
	if cleanedSlash == ".." || strings.HasPrefix(cleanedSlash, "../") || strings.Contains(cleanedSlash, "/../") {
		return nil, errors.New("security error: path escapes workspace boundaries")
	}
	cleanRel := filepath.Clean(filepath.FromSlash(cleanedSlash))

	absHostPath := filepath.Join(o.workspaceDir, cleanRel)
	if _, err := os.Stat(absHostPath); err != nil {
		return nil, fmt.Errorf("file not found: %s", cleanRel)
	}

	if lang == "" {
		lang = o.DetectLanguage(cleanRel)
	} else {
		lang = NormalizeLanguage(lang)
	}

	cfg, ok := DefaultLanguageConfigs[lang]
	if !ok {
		cfg = DefaultLanguageConfigs["python"]
	}

	// 1. Create an isolated temporary directory for execution
	sourceDir := filepath.Dir(absHostPath)
	tmpDir, entryFile, err := createIsolatedWorkDir(sourceDir, absHostPath)
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir) // Guaranteed cleanup of compiled binaries and temp files

	// 2. Strictly enforce 5-second timeout to prevent infinite loops and memory leaks
	execCtx, cancel := context.WithTimeout(ctx, DefaultExecutionTimeout)
	defer cancel()

	start := time.Now()

	exitCode, err := o.executeDirect(execCtx, cfg.ID, entryFile, tmpDir, absHostPath, stdin, stdout, stderr)
	duration := time.Since(start)

	return &ExecutionResult{
		Language: cfg.Name,
		Image:    "god-image-native",
		Duration: duration,
		ExitCode: exitCode,
		IsDocker: false,
	}, err
}

// executeDirect executes user code directly with standard OS binaries inside tmpDir.
func (o *Orchestrator) executeDirect(
	ctx context.Context,
	langID string,
	entryFile string,
	workDir string,
	absHostFile string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
) (int, error) {
	// Handle static web formats directly
	switch langID {
	case "html", "css", "markdown", "json", "yaml", "xml":
		data, err := os.ReadFile(filepath.Join(workDir, entryFile))
		if err != nil {
			data, err = os.ReadFile(absHostFile)
		}
		if err == nil {
			_, _ = stdout.Write(data)
			return 0, nil
		}
		return 1, err
	}

	var cmd *exec.Cmd

	switch langID {
	case "python":
		bin := findBin("python", "python3", "py")
		if bin == "" {
			return o.reportMissingBin("python3", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, "-u", entryFile)

	case "javascript":
		bin := findBin("node", "nodejs")
		if bin == "" {
			return o.reportMissingBin("node", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, entryFile)

	case "typescript":
		bin := findBin("tsx", "ts-node", "node")
		if bin == "" {
			return o.reportMissingBin("node/tsx", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, entryFile)

	case "go":
		bin := findBin("go")
		if bin == "" {
			return o.reportMissingBin("go", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, "run", entryFile)

	case "cpp":
		compiler := findBin("g++", "clang++")
		if compiler == "" {
			return o.reportMissingBin("g++", stderr)
		}
		exeName := exeSuffix("app")
		compileCmd := exec.CommandContext(ctx, compiler, "-O2", "-Wall", entryFile, "-o", exeName)
		compileCmd.Dir = workDir
		compileCmd.Stderr = stderr
		if err := compileCmd.Run(); err != nil {
			return o.handleExecError(ctx, err, stderr)
		}
		cmd = exec.CommandContext(ctx, filepath.Join(workDir, exeName))

	case "c":
		compiler := findBin("gcc", "clang")
		if compiler == "" {
			return o.reportMissingBin("gcc", stderr)
		}
		exeName := exeSuffix("app")
		compileCmd := exec.CommandContext(ctx, compiler, "-O2", "-Wall", entryFile, "-o", exeName)
		compileCmd.Dir = workDir
		compileCmd.Stderr = stderr
		if err := compileCmd.Run(); err != nil {
			return o.handleExecError(ctx, err, stderr)
		}
		cmd = exec.CommandContext(ctx, filepath.Join(workDir, exeName))

	case "rust":
		compiler := findBin("rustc")
		if compiler == "" {
			return o.reportMissingBin("rustc", stderr)
		}
		exeName := exeSuffix("app")
		compileCmd := exec.CommandContext(ctx, compiler, entryFile, "-o", exeName)
		compileCmd.Dir = workDir
		compileCmd.Stderr = stderr
		if err := compileCmd.Run(); err != nil {
			return o.handleExecError(ctx, err, stderr)
		}
		cmd = exec.CommandContext(ctx, filepath.Join(workDir, exeName))

	case "java":
		compiler := findBin("javac")
		runner := findBin("java")
		if compiler == "" || runner == "" {
			return o.reportMissingBin("javac/java", stderr)
		}
		compileCmd := exec.CommandContext(ctx, compiler, entryFile)
		compileCmd.Dir = workDir
		compileCmd.Stderr = stderr
		if err := compileCmd.Run(); err != nil {
			return o.handleExecError(ctx, err, stderr)
		}
		className := strings.TrimSuffix(filepath.Base(entryFile), filepath.Ext(entryFile))
		cmd = exec.CommandContext(ctx, runner, className)

	case "php":
		bin := findBin("php")
		if bin == "" {
			return o.reportMissingBin("php", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, entryFile)

	case "ruby":
		bin := findBin("ruby")
		if bin == "" {
			return o.reportMissingBin("ruby", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, entryFile)

	case "lua":
		bin := findBin("lua", "lua5.4", "lua5.3")
		if bin == "" {
			return o.reportMissingBin("lua", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, entryFile)

	case "shell":
		bin := findBin("sh", "bash")
		if bin == "" && isWindows {
			bin = findBin("cmd")
			if bin != "" {
				cmd = exec.CommandContext(ctx, bin, "/c", entryFile)
			}
		}
		if cmd == nil {
			if bin == "" {
				return o.reportMissingBin("sh", stderr)
			}
			cmd = exec.CommandContext(ctx, bin, entryFile)
		}

	case "powershell":
		bin := findBin("pwsh", "powershell")
		if bin == "" {
			return o.reportMissingBin("pwsh/powershell", stderr)
		}
		cmd = exec.CommandContext(ctx, bin, "-File", entryFile)

	case "sql":
		if sqlitePath := findBin("sqlite3"); sqlitePath != "" {
			cmd = exec.CommandContext(ctx, sqlitePath, ":memory:")
			if data, err := os.ReadFile(filepath.Join(workDir, entryFile)); err == nil {
				cmd.Stdin = bytes.NewReader(data)
			}
		} else {
			// Fallback in-memory SQLite via python
			pyBin := findBin("python", "python3", "py")
			if pyBin == "" {
				return o.reportMissingBin("sqlite3/python", stderr)
			}
			pyScript := `import sqlite3, sys
conn = sqlite3.connect(':memory:')
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    sql = f.read()
for stmt in sql.split(';'):
    stmt = stmt.strip()
    if stmt:
        res = conn.execute(stmt)
        for r in res.fetchall():
            print(r)
`
			cmd = exec.CommandContext(ctx, pyBin, "-u", "-c", pyScript, filepath.Join(workDir, entryFile))
		}

	default:
		// Attempt direct execution with python or shell fallback
		bin := findBin("python", "python3", "py")
		if bin != "" {
			cmd = exec.CommandContext(ctx, bin, "-u", entryFile)
		} else {
			return o.reportMissingBin(langID, stderr)
		}
	}

	cmd.Dir = workDir
	if stdin != nil && cmd.Stdin == nil {
		cmd.Stdin = stdin
	}
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	err := cmd.Run()
	return o.handleExecError(ctx, err, stderr)
}

func (o *Orchestrator) reportMissingBin(name string, stderr io.Writer) (int, error) {
	_, _ = fmt.Fprintf(stderr, "[VoidLAB God Engine] '%s' compiler/runtime is not installed in the environment.\n", name)
	return 127, fmt.Errorf("runtime not found: %s", name)
}

func (o *Orchestrator) handleExecError(ctx context.Context, err error, stderr io.Writer) (int, error) {
	if err == nil {
		return 0, nil
	}

	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		_, _ = io.WriteString(stderr, "\n[VoidLAB Execution Timeout] Process exceeded maximum execution time limit (5.0s). Terminated to prevent infinite loops and memory leaks.\n")
		return 124, ctx.Err()
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitCode(), err
	}

	return 1, err
}

func (o *Orchestrator) initProfiles() {
	for id, cfg := range DefaultLanguageConfigs {
		o.profiles[id] = LanguageProfile{
			Name:        cfg.Name,
			Image:       LanguageImageMap[id],
			Timeout:     cfg.Timeout,
			MemoryLimit: cfg.MemoryLimit,
			CPULimit:    cfg.CPULimit,
			Command: func(p string) []string {
				return []string{cfg.RunCmd}
			},
		}
	}
}

// DetectLanguage matches file extension or name to one of the supported language profiles.
func (o *Orchestrator) DetectLanguage(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".cpp", ".cc", ".cxx", ".hpp":
		return "cpp"
	case ".c", ".h":
		return "c"
	case ".rs":
		return "rust"
	case ".py":
		return "python"
	case ".go":
		return "go"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	case ".ts", ".tsx":
		return "typescript"
	case ".java":
		return "java"
	case ".cs":
		return "csharp"
	case ".php":
		return "php"
	case ".rb":
		return "ruby"
	case ".swift":
		return "swift"
	case ".kt", ".kts":
		return "kotlin"
	case ".lua":
		return "lua"
	case ".sh", ".bash":
		return "shell"
	case ".ps1":
		return "powershell"
	case ".sql":
		return "sql"
	case ".html", ".htm":
		return "html"
	case ".css":
		return "css"
	case ".md", ".markdown":
		return "markdown"
	case ".json":
		return "json"
	case ".yaml", ".yml":
		return "yaml"
	case ".xml":
		return "xml"
	default:
		return "python"
	}
}

// NormalizeLanguage canonicalizes language aliases (e.g. "node" -> "javascript", "bash" -> "shell").
func NormalizeLanguage(lang string) string {
	l := strings.ToLower(strings.TrimSpace(lang))
	switch l {
	case "node", "nodejs", "js":
		return "javascript"
	case "ts":
		return "typescript"
	case "py":
		return "python"
	case "c++":
		return "cpp"
	case "golang":
		return "go"
	case "c#", "dotnet":
		return "csharp"
	case "sh", "bash":
		return "shell"
	case "pwsh":
		return "powershell"
	case "rb":
		return "ruby"
	case "sql", "sqlite", "sqlite3":
		return "sql"
	case "html", "htm":
		return "html"
	case "css":
		return "css"
	case "md", "markdown":
		return "markdown"
	case "json":
		return "json"
	case "yaml", "yml":
		return "yaml"
	case "xml":
		return "xml"
	default:
		if _, ok := LanguageImageMap[l]; ok {
			return l
		}
		return "python"
	}
}

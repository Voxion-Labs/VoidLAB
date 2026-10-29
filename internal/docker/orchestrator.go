package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// LanguageConfig defines container metadata, Alpine/slim images, default extensions, and resource ceilings for a language.
type LanguageConfig struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Image       string        `json:"image"`        // Specific lightweight Alpine or slim Docker image
	Extension   string        `json:"extension"`    // Standard file extension
	CompileCmd  string        `json:"compile_cmd"`  // Compilation command (empty for interpreted languages)
	RunCmd      string        `json:"run_cmd"`      // Execution command
	Timeout     time.Duration `json:"timeout"`
	MemoryLimit string        `json:"memory_limit"` // e.g. "256m", "512m"
	CPULimit    string        `json:"cpu_limit"`    // e.g. "1.0", "0.5"
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

// LanguageProfile defines Docker image, compile steps, and execution command per language.
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
}

// LanguageImageMap explicitly maps all 16 supported languages to their official lightweight Alpine/slim images.
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
}

// DefaultLanguageConfigs provides full container and execution configurations for all 16 supported runtimes.
var DefaultLanguageConfigs = map[string]LanguageConfig{
	"cpp": {
		ID:          "cpp",
		Name:        "C++",
		Image:       "gcc:alpine",
		Extension:   ".cpp",
		CompileCmd:  "g++ -O2 -Wall main.cpp -o app",
		RunCmd:      "./app",
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"c": {
		ID:          "c",
		Name:        "C",
		Image:       "gcc:alpine",
		Extension:   ".c",
		CompileCmd:  "gcc -O2 -Wall main.c -o app",
		RunCmd:      "./app",
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"rust": {
		ID:          "rust",
		Name:        "Rust",
		Image:       "rust:alpine",
		Extension:   ".rs",
		CompileCmd:  "rustc main.rs -o app",
		RunCmd:      "./app",
		Timeout:     60 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"python": {
		ID:          "python",
		Name:        "Python",
		Image:       "python:3.11-alpine",
		Extension:   ".py",
		CompileCmd:  "",
		RunCmd:      "python -u main.py",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
	},
	"go": {
		ID:          "go",
		Name:        "Go",
		Image:       "golang:1.23-alpine",
		Extension:   ".go",
		CompileCmd:  "",
		RunCmd:      "go run main.go",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"javascript": {
		ID:          "javascript",
		Name:        "JavaScript",
		Image:       "node:20-alpine",
		Extension:   ".js",
		CompileCmd:  "",
		RunCmd:      "node main.js",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
	},
	"typescript": {
		ID:          "typescript",
		Name:        "TypeScript",
		Image:       "node:20-alpine",
		Extension:   ".ts",
		CompileCmd:  "",
		RunCmd:      "npx tsx main.ts",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"java": {
		ID:          "java",
		Name:        "Java",
		Image:       "eclipse-temurin:21-alpine",
		Extension:   ".java",
		CompileCmd:  "javac Main.java",
		RunCmd:      "java Main",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"csharp": {
		ID:          "csharp",
		Name:        "C#",
		Image:       "mcr.microsoft.com/dotnet/sdk:8.0-alpine",
		Extension:   ".cs",
		CompileCmd:  "dotnet build -o /tmp/out",
		RunCmd:      "dotnet /tmp/out/app.dll",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"php": {
		ID:          "php",
		Name:        "PHP",
		Image:       "php:8.3-alpine",
		Extension:   ".php",
		CompileCmd:  "",
		RunCmd:      "php main.php",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
	},
	"ruby": {
		ID:          "ruby",
		Name:        "Ruby",
		Image:       "ruby:3.2-alpine",
		Extension:   ".rb",
		CompileCmd:  "",
		RunCmd:      "ruby main.rb",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
	},
	"swift": {
		ID:          "swift",
		Name:        "Swift",
		Image:       "swift:slim",
		Extension:   ".swift",
		CompileCmd:  "swiftc main.swift -o app",
		RunCmd:      "./app",
		Timeout:     60 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"kotlin": {
		ID:          "kotlin",
		Name:        "Kotlin",
		Image:       "amazoncorretto:21-alpine",
		Extension:   ".kt",
		CompileCmd:  "kotlinc main.kt -include-runtime -d app.jar",
		RunCmd:      "java -jar app.jar",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
	},
	"lua": {
		ID:          "lua",
		Name:        "Lua",
		Image:       "nickblah/lua:5.4-alpine",
		Extension:   ".lua",
		CompileCmd:  "",
		RunCmd:      "lua main.lua",
		Timeout:     20 * time.Second,
		MemoryLimit: "128m",
		CPULimit:    "0.5",
	},
	"shell": {
		ID:          "shell",
		Name:        "Shell",
		Image:       "alpine:latest",
		Extension:   ".sh",
		CompileCmd:  "",
		RunCmd:      "sh main.sh",
		Timeout:     20 * time.Second,
		MemoryLimit: "128m",
		CPULimit:    "0.5",
	},
	"powershell": {
		ID:          "powershell",
		Name:        "PowerShell",
		Image:       "mcr.microsoft.com/powershell:lts-alpine",
		Extension:   ".ps1",
		CompileCmd:  "",
		RunCmd:      "pwsh -File main.ps1",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
	},
}

// Orchestrator manages secure ephemeral container spawning and execution.
type Orchestrator struct {
	workspaceDir string
	profiles     map[string]LanguageProfile
	configs      map[string]LanguageConfig
}

// NewOrchestrator initializes the Docker execution engine.
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

// ExecuteCode represents the core execution engine entry point for the 16 supported languages (Phase 1A).
// Execution logic will be wired in Phase 1B.
func (o *Orchestrator) ExecuteCode(language string, workspacePath string) (*ExecutionResult, error) {
	// Phase 1A: Setup & Language Mapping (Execution logic deferred to Phase 1B)
	return nil, nil
}

// ExecuteCode package-level entry point function signature as requested by Phase 1A.
func ExecuteCode(language string, workspacePath string) (*ExecutionResult, error) {
	// Phase 1A: Setup & Language Mapping (Execution logic deferred to Phase 1B)
	return nil, nil
}

func (o *Orchestrator) initProfiles() {
	// Python 3.11 Alpine
	o.profiles["python"] = LanguageProfile{
		Name:        "Python",
		Image:       LanguageImageMap["python"],
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"python", "-u", path}
		},
	}

	// C++ GCC Alpine
	o.profiles["cpp"] = LanguageProfile{
		Name:        "C++",
		Image:       LanguageImageMap["cpp"],
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("g++ -O2 -Wall %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// C GCC Alpine
	o.profiles["c"] = LanguageProfile{
		Name:        "C",
		Image:       LanguageImageMap["c"],
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("gcc -O2 -Wall %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Rust Alpine
	o.profiles["rust"] = LanguageProfile{
		Name:        "Rust",
		Image:       LanguageImageMap["rust"],
		Timeout:     60 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("rustc %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Go Alpine
	o.profiles["go"] = LanguageProfile{
		Name:        "Go",
		Image:       LanguageImageMap["go"],
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"go", "run", path}
		},
	}

	// Node.js / JavaScript Alpine
	o.profiles["javascript"] = LanguageProfile{
		Name:        "JavaScript",
		Image:       LanguageImageMap["javascript"],
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"node", path}
		},
	}

	// TypeScript Node Alpine
	o.profiles["typescript"] = LanguageProfile{
		Name:        "TypeScript",
		Image:       LanguageImageMap["typescript"],
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("npx tsx %s || node %s", path, path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Java Temurin Alpine
	o.profiles["java"] = LanguageProfile{
		Name:        "Java",
		Image:       LanguageImageMap["java"],
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("javac %s -d /tmp && java -cp /tmp Main", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// C# .NET SDK Alpine
	o.profiles["csharp"] = LanguageProfile{
		Name:        "C#",
		Image:       LanguageImageMap["csharp"],
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"dotnet", "run", path}
		},
	}

	// PHP Alpine
	o.profiles["php"] = LanguageProfile{
		Name:        "PHP",
		Image:       LanguageImageMap["php"],
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"php", path}
		},
	}

	// Ruby Alpine
	o.profiles["ruby"] = LanguageProfile{
		Name:        "Ruby",
		Image:       LanguageImageMap["ruby"],
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"ruby", path}
		},
	}

	// Swift Slim
	o.profiles["swift"] = LanguageProfile{
		Name:        "Swift",
		Image:       LanguageImageMap["swift"],
		Timeout:     60 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("swiftc %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Kotlin Corretto Alpine
	o.profiles["kotlin"] = LanguageProfile{
		Name:        "Kotlin",
		Image:       LanguageImageMap["kotlin"],
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("kotlinc %s -include-runtime -d /tmp/app.jar && java -jar /tmp/app.jar", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Lua Alpine
	o.profiles["lua"] = LanguageProfile{
		Name:        "Lua",
		Image:       LanguageImageMap["lua"],
		Timeout:     20 * time.Second,
		MemoryLimit: "128m",
		CPULimit:    "0.5",
		Command: func(path string) []string {
			return []string{"lua", path}
		},
	}

	// Shell Alpine
	o.profiles["shell"] = LanguageProfile{
		Name:        "Shell",
		Image:       LanguageImageMap["shell"],
		Timeout:     20 * time.Second,
		MemoryLimit: "128m",
		CPULimit:    "0.5",
		Command: func(path string) []string {
			return []string{"sh", path}
		},
	}

	// PowerShell LTS Alpine
	o.profiles["powershell"] = LanguageProfile{
		Name:        "PowerShell",
		Image:       LanguageImageMap["powershell"],
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"pwsh", "-File", path}
		},
	}
}

// DetectLanguage matches file extension or name to one of the 16 language profiles.
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
	default:
		if _, ok := LanguageImageMap[l]; ok {
			return l
		}
		return "python"
	}
}

// IsDockerAvailable verifies that docker CLI exists and the daemon responds.
func (o *Orchestrator) IsDockerAvailable(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "info")
	return cmd.Run() == nil
}

// Run executes a workspace file in an ephemeral, resource-constrained Docker container.
// If Docker is not available, it safely falls back to host execution with notice.
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

	profile, ok := o.profiles[lang]
	if !ok {
		profile = o.profiles["python"]
	}

	execCtx, cancel := context.WithTimeout(ctx, profile.Timeout)
	defer cancel()

	start := time.Now()
	containerPath := "/workspace/" + filepath.ToSlash(cleanRel)

	if o.IsDockerAvailable(ctx) {
		result, err := o.runDocker(execCtx, profile, cleanRel, containerPath, stdin, stdout, stderr)
		if result != nil {
			result.Duration = time.Since(start)
		}
		return result, err
	}

	// Fallback runner when Docker daemon is not active on host
	result, err := o.runLocalFallback(execCtx, profile, absHostPath, stdin, stdout, stderr)
	if result != nil {
		result.Duration = time.Since(start)
	}
	return result, err
}

func (o *Orchestrator) runDocker(
	ctx context.Context,
	profile LanguageProfile,
	relPath string,
	containerPath string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
) (*ExecutionResult, error) {
	// Construct secure ephemeral docker arguments:
	// --rm: ephemeral container destroyed on exit
	// -i: interactive stdin pipe
	// -v: secure volume mount of workspace into container
	// -w: container working directory
	// --memory / --cpus / --pids-limit: resource ceilings to prevent DoS / fork bombs
	// --security-opt: prevent privilege escalation
	args := []string{
		"run", "--rm", "-i",
		"--memory=" + profile.MemoryLimit,
		"--cpus=" + profile.CPULimit,
		"--pids-limit=64",
		"--security-opt=no-new-privileges",
		"-v", fmt.Sprintf("%s:/workspace:rw", o.workspaceDir),
		"-w", "/workspace",
		profile.Image,
	}

	args = append(args, profile.Command(containerPath)...)

	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stdin = stdin
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return &ExecutionResult{
		Language: profile.Name,
		Image:    profile.Image,
		ExitCode: exitCode,
		IsDocker: true,
	}, err
}

func (o *Orchestrator) runLocalFallback(
	ctx context.Context,
	profile LanguageProfile,
	absHostPath string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
) (*ExecutionResult, error) {
	_, _ = io.WriteString(stderr, fmt.Sprintf("[VoidLAB Sandbox] Docker daemon not reachable; executing %s via local fallback.\n", profile.Name))

	var cmd *exec.Cmd
	switch profile.Name {
	case "Python":
		cmd = exec.CommandContext(ctx, "python", "-u", absHostPath)
	case "Go":
		cmd = exec.CommandContext(ctx, "go", "run", absHostPath)
	case "JavaScript":
		cmd = exec.CommandContext(ctx, "node", absHostPath)
	case "Shell":
		cmd = exec.CommandContext(ctx, "sh", absHostPath)
	default:
		cmd = exec.CommandContext(ctx, "python", "-u", absHostPath)
	}

	cmd.Dir = o.workspaceDir
	cmd.Stdin = stdin
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return &ExecutionResult{
		Language: profile.Name,
		Image:    "local-fallback",
		ExitCode: exitCode,
		IsDocker: false,
	}, err
}

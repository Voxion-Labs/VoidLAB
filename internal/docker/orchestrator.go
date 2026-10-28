package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

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

// Orchestrator manages secure ephemeral container spawning and execution.
type Orchestrator struct {
	workspaceDir string
	profiles     map[string]LanguageProfile
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
	}

	orc.initProfiles()
	return orc, nil
}

func (o *Orchestrator) initProfiles() {
	// Python 3.11 Alpine
	o.profiles["python"] = LanguageProfile{
		Name:        "Python",
		Image:       "python:3.11-alpine",
		Timeout:     30 * time.Second,
		MemoryLimit: "256m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			// -u for unbuffered stdout/stderr to stream instantly over WebSockets
			return []string{"python", "-u", path}
		},
	}

	// C++ GCC Alpine
	o.profiles["cpp"] = LanguageProfile{
		Name:        "C++",
		Image:       "gcc:alpine",
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			// Compile to /tmp/app and execute
			cmd := fmt.Sprintf("g++ -O2 -Wall %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// C GCC Alpine
	o.profiles["c"] = LanguageProfile{
		Name:        "C",
		Image:       "gcc:alpine",
		Timeout:     30 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("gcc -O2 -Wall %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Go Alpine
	o.profiles["go"] = LanguageProfile{
		Name:        "Go",
		Image:       "golang:1.23-alpine",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			return []string{"go", "run", path}
		},
	}

	// Node.js Alpine
	o.profiles["javascript"] = LanguageProfile{
		Name:        "JavaScript",
		Image:       "node:20-alpine",
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
		Image:       "node:20-alpine",
		Timeout:     45 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("npx tsx %s || node %s", path, path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Rust Alpine
	o.profiles["rust"] = LanguageProfile{
		Name:        "Rust",
		Image:       "rust:alpine",
		Timeout:     60 * time.Second,
		MemoryLimit: "512m",
		CPULimit:    "1.0",
		Command: func(path string) []string {
			cmd := fmt.Sprintf("rustc %s -o /tmp/app && /tmp/app", path)
			return []string{"sh", "-c", cmd}
		},
	}

	// Shell Alpine
	o.profiles["shell"] = LanguageProfile{
		Name:        "Shell",
		Image:       "alpine:latest",
		Timeout:     20 * time.Second,
		MemoryLimit: "128m",
		CPULimit:    "0.5",
		Command: func(path string) []string {
			return []string{"sh", path}
		},
	}
}

// DetectLanguage matches file extension or name to language profile.
func (o *Orchestrator) DetectLanguage(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".py":
		return "python"
	case ".cpp", ".cc", ".cxx", ".hpp":
		return "cpp"
	case ".c", ".h":
		return "c"
	case ".go":
		return "go"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	case ".ts", ".tsx":
		return "typescript"
	case ".rs":
		return "rust"
	case ".sh", ".bash":
		return "shell"
	default:
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
	cleanRel := filepath.Clean(filepath.FromSlash(strings.TrimSpace(relPath)))
	if filepath.IsAbs(cleanRel) || cleanRel == ".." || strings.HasPrefix(cleanRel, ".."+string(filepath.Separator)) {
		return nil, errors.New("security error: path escapes workspace boundaries")
	}

	absHostPath := filepath.Join(o.workspaceDir, cleanRel)
	if _, err := os.Stat(absHostPath); err != nil {
		return nil, fmt.Errorf("file not found: %s", cleanRel)
	}

	if lang == "" {
		lang = o.DetectLanguage(cleanRel)
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
		// Attempt direct python or shell execution
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

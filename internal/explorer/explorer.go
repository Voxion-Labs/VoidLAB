package explorer

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// TreeItem represents a file or directory node in the explorer hierarchy.
type TreeItem struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Path         string   `json:"path"` // Forward-slash normalized relative path
	Kind         string   `json:"kind"` // "file" or "folder"
	Depth        int      `json:"depth"`
	PaddingLeft  int      `json:"padding_left"`
	IndentLevels []int    `json:"indent_levels"`
	IsActive     bool     `json:"is_active"`
	IsCollapsed  bool     `json:"is_collapsed"`
	Language      string   `json:"language"`
	LanguageLabel string   `json:"language_label"`
	IconType      string   `json:"icon_type"` // "python", "react", "markdown", "git", "config", "go", "code", "file"
}

// ActiveFile represents the currently open buffer in the editor.
type ActiveFile struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Path          string `json:"path"`
	Content       string `json:"content"`
	Language      string `json:"language"`
	LanguageLabel string `json:"language_label"`
}

// TabFile represents an open file tab in the editor tab bar.
type TabFile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsActive bool   `json:"is_active"`
}

// WorkspaceData is the view-model passed to templates.
type WorkspaceData struct {
	Title           string
	TreeItems       []TreeItem
	ActiveFile      *ActiveFile
	OpenTabs        []TabFile
	StatusMessage   string
	Cwd             string
	Theme           string
	UserInitial     string
	TerminalHistory []TerminalHistoryItem
	IsEditor        bool
	IsLanding       bool
	User            string
}

// TerminalHistoryItem models command entries in the sandbox shell.
type TerminalHistoryItem struct {
	ID      string `json:"id"`
	Cwd     string `json:"cwd"`
	Command string `json:"command"`
	Output  string `json:"output"`
	Status  string `json:"status"` // "success" or "error"
}

// Service manages the local-first workspace directory with concurrency safety and path traversal protection.
type Service struct {
	mu               sync.RWMutex
	rootDir          string
	activePath       string
	openTabs         []string // list of relative paths
	collapsedFolders map[string]bool
}

// NewService instantiates a workspace service rooted at the given directory.
func NewService(rootDir string) (*Service, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve workspace root: %w", err)
	}

	if err := os.MkdirAll(absRoot, 0755); err != nil {
		return nil, fmt.Errorf("failed to initialize workspace directory: %w", err)
	}

	s := &Service{
		rootDir:          absRoot,
		activePath:       "src/main.py",
		openTabs:         []string{"src/main.py"},
		collapsedFolders: make(map[string]bool),
	}

	// Seed starter files if workspace is empty
	if err := s.seedDefaults(); err != nil {
		return nil, fmt.Errorf("failed to seed default workspace: %w", err)
	}

	return s, nil
}

// seedDefaults creates initial files if workspace is unpopulated.
func (s *Service) seedDefaults() error {
	entries, err := os.ReadDir(s.rootDir)
	if err != nil {
		return err
	}
	if len(entries) > 0 {
		return nil
	}

	srcDir := filepath.Join(s.rootDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		return err
	}

	mainPy := `# VoidLAB - High-Performance Local-First Cloud IDE
# Hyper-optimized Go + HTMX + TailwindCSS + WASM Architecture

def main():
    print("Welcome to VoidLAB 2.0")
    print("Sub-millisecond local execution engine online.")

if __name__ == "__main__":
    main()
`
	if err := os.WriteFile(filepath.Join(srcDir, "main.py"), []byte(mainPy), 0644); err != nil {
		return err
	}

	readmeMd := `# VoidLAB Workspace

Local-first browser IDE, compiler, and workspace by Voxion Labs.
Sub-millisecond execution with Go, HTMX, and WebAssembly.
`
	return os.WriteFile(filepath.Join(s.rootDir, "README.md"), []byte(readmeMd), 0644)
}

// ResolveSafePath validates and resolves a relative path strictly within the workspace root.
func (s *Service) ResolveSafePath(relPath string) (string, error) {
	trimmed := strings.TrimSpace(relPath)
	if trimmed == "" {
		return s.rootDir, nil
	}

	// Cross-platform normalization: treat both '\' and '/' as directory separators
	slashNormalized := strings.ReplaceAll(trimmed, "\\", "/")

	// Reject absolute paths, root-anchored paths, or Windows drive prefixes (e.g. C:)
	if strings.HasPrefix(slashNormalized, "/") || (len(slashNormalized) > 1 && slashNormalized[1] == ':') {
		return "", errors.New("security error: absolute paths not permitted")
	}

	cleanedSlash := path.Clean(slashNormalized)
	if cleanedSlash == ".." || strings.HasPrefix(cleanedSlash, "../") || strings.Contains(cleanedSlash, "/../") || strings.HasSuffix(cleanedSlash, "/..") {
		return "", errors.New("security error: path traversal attempt detected")
	}

	cleanedOS := filepath.Clean(filepath.FromSlash(cleanedSlash))
	if filepath.IsAbs(cleanedOS) {
		return "", errors.New("security error: absolute paths not permitted")
	}

	fullPath := filepath.Join(s.rootDir, cleanedOS)

	// Ensure destination remains within root boundary
	rel, err := filepath.Rel(s.rootDir, fullPath)
	relSlash := filepath.ToSlash(rel)
	if err != nil || relSlash == ".." || strings.HasPrefix(relSlash, "../") {
		return "", errors.New("security error: target escapes workspace root")
	}

	return fullPath, nil
}

// CreateItem creates a new file or directory at the specified relative path.
func (s *Service) CreateItem(relPath string, isFolder bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fullPath, err := s.ResolveSafePath(relPath)
	if err != nil {
		return err
	}

	if isFolder {
		return os.MkdirAll(fullPath, 0755)
	}

	parent := filepath.Dir(fullPath)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return err
	}

	// Open or create file with 0644
	f, err := os.OpenFile(fullPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	_ = f.Close()

	normPath := filepath.ToSlash(relPath)
	s.activePath = normPath
	s.addOpenTab(normPath)
	return nil
}

// RenameItem atomically renames a file or folder.
func (s *Service) RenameItem(oldRelPath, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldFullPath, err := s.ResolveSafePath(oldRelPath)
	if err != nil {
		return err
	}

	cleanNewName := filepath.Base(filepath.Clean(newName))
	if cleanNewName == "." || cleanNewName == ".." || cleanNewName == "/" || cleanNewName == "\\" {
		return errors.New("invalid new file/folder name")
	}

	parentRel := filepath.Dir(oldRelPath)
	newRelPath := filepath.Join(parentRel, cleanNewName)
	newFullPath, err := s.ResolveSafePath(newRelPath)
	if err != nil {
		return err
	}

	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		return err
	}

	// Update active path and open tabs if renamed
	oldNorm := filepath.ToSlash(oldRelPath)
	newNorm := filepath.ToSlash(newRelPath)
	if s.activePath == oldNorm {
		s.activePath = newNorm
	}
	for i, tab := range s.openTabs {
		if tab == oldNorm {
			s.openTabs[i] = newNorm
		} else if strings.HasPrefix(tab, oldNorm+"/") {
			s.openTabs[i] = newNorm + strings.TrimPrefix(tab, oldNorm)
		}
	}

	return nil
}

// DeleteItem removes a file or directory tree from the workspace.
func (s *Service) DeleteItem(relPath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fullPath, err := s.ResolveSafePath(relPath)
	if err != nil {
		return err
	}

	if fullPath == s.rootDir {
		return errors.New("cannot delete workspace root")
	}

	if err := os.RemoveAll(fullPath); err != nil {
		return err
	}

	normPath := filepath.ToSlash(relPath)
	// Remove from tabs
	filtered := make([]string, 0, len(s.openTabs))
	for _, t := range s.openTabs {
		if t != normPath && !strings.HasPrefix(t, normPath+"/") {
			filtered = append(filtered, t)
		}
	}
	s.openTabs = filtered
	if s.activePath == normPath || strings.HasPrefix(s.activePath, normPath+"/") {
		if len(s.openTabs) > 0 {
			s.activePath = s.openTabs[0]
		} else {
			s.activePath = ""
		}
	}

	return nil
}

// MoveItem moves a source file or folder into target folder.
func (s *Service) MoveItem(srcRelPath, destRelFolder string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	srcFullPath, err := s.ResolveSafePath(srcRelPath)
	if err != nil {
		return err
	}

	destFolderFullPath, err := s.ResolveSafePath(destRelFolder)
	if err != nil {
		return err
	}

	// Assert dest is a directory
	destStat, err := os.Stat(destFolderFullPath)
	if err != nil {
		return fmt.Errorf("target destination does not exist: %w", err)
	}
	if !destStat.IsDir() {
		return errors.New("target destination must be a directory")
	}

	// Prevent moving a directory into itself or a subdirectory of itself
	srcRelClean := filepath.Clean(srcRelPath)
	destRelClean := filepath.Clean(destRelFolder)
	if srcRelClean == destRelClean || strings.HasPrefix(destRelClean, srcRelClean+string(filepath.Separator)) {
		return errors.New("cannot move directory into itself or its own subdirectory")
	}

	baseName := filepath.Base(srcFullPath)
	finalDestFullPath := filepath.Join(destFolderFullPath, baseName)

	if err := os.Rename(srcFullPath, finalDestFullPath); err != nil {
		return err
	}

	finalRelPath, err := filepath.Rel(s.rootDir, finalDestFullPath)
	if err == nil {
		srcNorm := filepath.ToSlash(srcRelPath)
		finalNorm := filepath.ToSlash(finalRelPath)
		if s.activePath == srcNorm {
			s.activePath = finalNorm
		}
		for i, tab := range s.openTabs {
			if tab == srcNorm {
				s.openTabs[i] = finalNorm
			} else if strings.HasPrefix(tab, srcNorm+"/") {
				s.openTabs[i] = finalNorm + strings.TrimPrefix(tab, srcNorm)
			}
		}
	}

	return nil
}

// ToggleFolder collapses or expands a folder in the explorer view.
func (s *Service) ToggleFolder(relPath string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	norm := filepath.ToSlash(relPath)
	if s.collapsedFolders[norm] {
		delete(s.collapsedFolders, norm)
	} else {
		s.collapsedFolders[norm] = true
	}
}

// SetActiveFile changes the active editor file.
func (s *Service) SetActiveFile(relPath string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	norm := filepath.ToSlash(relPath)
	s.activePath = norm
	s.addOpenTab(norm)
}

// CloseTab removes a tab from the open tabs bar.
func (s *Service) CloseTab(relPath string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	norm := filepath.ToSlash(relPath)
	filtered := make([]string, 0, len(s.openTabs))
	for _, t := range s.openTabs {
		if t != norm {
			filtered = append(filtered, t)
		}
	}
	s.openTabs = filtered
	if s.activePath == norm {
		if len(s.openTabs) > 0 {
			s.activePath = s.openTabs[len(s.openTabs)-1]
		} else {
			s.activePath = ""
		}
	}
}

// ReadFileContent returns the raw content string of a workspace file.
func (s *Service) ReadFileContent(relPath string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	fullPath, err := s.ResolveSafePath(relPath)
	if err != nil {
		return "", err
	}

	bytes, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// WriteFileContent writes content to a workspace file safely.
func (s *Service) WriteFileContent(relPath string, content []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fullPath, err := s.ResolveSafePath(relPath)
	if err != nil {
		return err
	}

	return os.WriteFile(fullPath, content, 0644)
}

func (s *Service) addOpenTab(relPath string) {
	for _, t := range s.openTabs {
		if t == relPath {
			return
		}
	}
	s.openTabs = append(s.openTabs, relPath)
}

// BuildWorkspaceData constructs the complete view-model for templates.
func (s *Service) BuildWorkspaceData() (*WorkspaceData, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	treeItems, err := s.scanDirectory(s.rootDir, "", 0)
	if err != nil {
		return nil, err
	}

	var active *ActiveFile
	if s.activePath != "" {
		content, _ := s.ReadFileContent(s.activePath)
		name := filepath.Base(s.activePath)
		lang, label := detectLanguage(name)
		active = &ActiveFile{
			ID:            s.activePath,
			Name:          name,
			Path:          s.activePath,
			Content:       content,
			Language:      lang,
			LanguageLabel: label,
		}
	}

	tabs := make([]TabFile, 0, len(s.openTabs))
	for _, t := range s.openTabs {
		tabs = append(tabs, TabFile{
			ID:       t,
			Name:     filepath.Base(t),
			Path:     t,
			IsActive: t == s.activePath,
		})
	}

	return &WorkspaceData{
		Title:         "VoidLAB - Local-First Cloud IDE",
		TreeItems:     treeItems,
		ActiveFile:    active,
		OpenTabs:      tabs,
		StatusMessage: "Ready",
		Cwd:           "/workspace",
		Theme:         "light",
		UserInitial:   "R",
	}, nil
}

// scanDirectory recursively walks directory nodes and formats TreeItem metadata.
func (s *Service) scanDirectory(absDir, relDir string, depth int) ([]TreeItem, error) {
	entries, err := os.ReadDir(absDir)
	if err != nil {
		return nil, err
	}

	// Sort entries: folders first, then files alphabetically
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() && !entries[j].IsDir() {
			return true
		}
		if !entries[i].IsDir() && entries[j].IsDir() {
			return false
		}
		return strings.ToLower(entries[i].Name()) < strings.ToLower(entries[j].Name())
	})

	var items []TreeItem

	for _, entry := range entries {
		name := entry.Name()
		// Skip hidden git internals
		if name == ".git" {
			continue
		}

		itemRel := name
		if relDir != "" {
			itemRel = relDir + "/" + name
		}

		indentLevels := make([]int, depth)
		for i := 0; i < depth; i++ {
			indentLevels[i] = 14 + i*14
		}

		if entry.IsDir() {
			isCollapsed := s.collapsedFolders[itemRel]
			item := TreeItem{
				ID:           itemRel,
				Name:         name,
				Path:         itemRel,
				Kind:         "folder",
				Depth:        depth,
				PaddingLeft:  8 + depth*14,
				IndentLevels: indentLevels,
				IsCollapsed:  isCollapsed,
				IconType:     "folder",
			}
			items = append(items, item)

			// Recurse into folder if not collapsed
			if !isCollapsed {
				subPath := filepath.Join(absDir, name)
				subItems, err := s.scanDirectory(subPath, itemRel, depth+1)
				if err == nil {
					items = append(items, subItems...)
				}
			}
		} else {
			_, label := detectLanguage(name)
			item := TreeItem{
				ID:            itemRel,
				Name:          name,
				Path:          itemRel,
				Kind:          "file",
				Depth:         depth,
				PaddingLeft:   8 + depth*14,
				IndentLevels:  indentLevels,
				IsActive:      itemRel == s.activePath,
				Language:      label,
				LanguageLabel: label,
				IconType:      detectIconType(name),
			}
			items = append(items, item)
		}
	}

	return items, nil
}

func detectIconType(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasPrefix(lower, ".env"):
		return "env"
	case strings.HasPrefix(lower, ".git") || lower == ".gitignore":
		return "git"
	case strings.HasSuffix(lower, ".md"):
		return "markdown"
	case strings.HasSuffix(lower, ".py"):
		return "python"
	case strings.HasSuffix(lower, ".go"):
		return "go"
	case strings.HasSuffix(lower, ".tsx") || strings.HasSuffix(lower, ".jsx"):
		return "react"
	case strings.HasSuffix(lower, ".ts") || strings.HasSuffix(lower, ".js"):
		return "code"
	case strings.HasSuffix(lower, ".json") || strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml") || strings.HasSuffix(lower, ".toml"):
		return "config"
	default:
		return "file"
	}
}

func detectLanguage(name string) (lang, label string) {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".py":
		return "python", "Python"
	case ".go":
		return "go", "Go"
	case ".ts":
		return "typescript", "TypeScript"
	case ".tsx":
		return "typescriptreact", "TypeScript React"
	case ".js":
		return "javascript", "JavaScript"
	case ".jsx":
		return "javascriptreact", "JavaScript React"
	case ".json":
		return "json", "JSON"
	case ".md":
		return "markdown", "Markdown"
	case ".sh", ".bash":
		return "shell", "Bash"
	case ".sql":
		return "sql", "SQL"
	case ".html", ".htm":
		return "html", "HTML"
	case ".css":
		return "css", "CSS"
	case ".c", ".h":
		return "c", "C"
	case ".cpp", ".cc", ".cxx", ".hpp":
		return "cpp", "C++"
	case ".rs":
		return "rust", "Rust"
	case ".java":
		return "java", "Java"
	case ".cs":
		return "csharp", "C#"
	case ".php":
		return "php", "PHP"
	case ".rb":
		return "ruby", "Ruby"
	case ".swift":
		return "swift", "Swift"
	case ".kt", ".kts":
		return "kotlin", "Kotlin"
	case ".lua":
		return "lua", "Lua"
	case ".ps1":
		return "powershell", "PowerShell"
	case ".yaml", ".yml":
		return "yaml", "YAML"
	case ".xml":
		return "xml", "XML"
	default:
		return "plaintext", "Plain Text"
	}
}

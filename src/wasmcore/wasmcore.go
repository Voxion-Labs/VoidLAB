package wasmcore

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ValidationResult represents the output of instant client-side syntax checks.
type ValidationResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
	Line    int    `json:"line,omitempty"`
	Column  int    `json:"column,omitempty"`
}

// CodeMetrics holds instant document statistics calculated by WASM.
type CodeMetrics struct {
	Lines        int `json:"lines"`
	NonEmpty     int `json:"non_empty_lines"`
	Words        int `json:"words"`
	Characters   int `json:"characters"`
	Bytes        int `json:"bytes"`
	CommentLines int `json:"comment_lines"`
}

// ValidateCode performs instant client-side syntax and structural validation.
func ValidateCode(code string, lang string) ValidationResult {
	if strings.TrimSpace(code) == "" {
		return ValidationResult{Valid: true, Message: "Clean (empty buffer)"}
	}

	normLang := strings.ToLower(strings.TrimSpace(lang))

	// 1. JSON strict validation
	if normLang == "json" {
		var jsTarget any
		if err := json.Unmarshal([]byte(code), &jsTarget); err != nil {
			return ValidationResult{
				Valid:   false,
				Message: fmt.Sprintf("JSON Syntax Error: %v", err),
				Line:    1,
			}
		}
		return ValidationResult{Valid: true, Message: "Valid JSON schema"}
	}

	// 2. Bracket, Parenthesis & Delimiter Balance Checker
	var stack []rune
	lines := strings.Split(code, "\n")

	for lineNum, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Check Python colon syntax on statement headers
		if (normLang == "python" || normLang == "py") && trimmed != "" && !strings.HasPrefix(trimmed, "#") {
			blockPrefixes := []string{"def ", "class ", "if ", "elif ", "else:", "for ", "while ", "try:", "except ", "except:", "finally:", "with "}
			for _, prefix := range blockPrefixes {
				if strings.HasPrefix(trimmed, prefix) && !strings.HasSuffix(trimmed, ":") && !strings.Contains(trimmed, "#") {
					return ValidationResult{
						Valid:   false,
						Message: fmt.Sprintf("Missing trailing ':' on statement: %s", trimmed),
						Line:    lineNum + 1,
					}
				}
			}
		}

		inString := false
		var quoteChar rune

		for colNum, ch := range line {
			if inString {
				if ch == quoteChar && (colNum == 0 || line[colNum-1] != '\\') {
					inString = false
				}
				continue
			}

			if ch == '"' || ch == '\'' || ch == '`' {
				inString = true
				quoteChar = ch
				continue
			}

			// Single line comments
			if (ch == '#' && (normLang == "python" || normLang == "shell")) || (ch == '/' && colNum+1 < len(line) && line[colNum+1] == '/') {
				break
			}

			switch ch {
			case '(', '[', '{':
				stack = append(stack, ch)
			case ')':
				if len(stack) == 0 || stack[len(stack)-1] != '(' {
					return ValidationResult{
						Valid:   false,
						Message: fmt.Sprintf("Unmatched closing parenthesis ')' at line %d:%d", lineNum+1, colNum+1),
						Line:    lineNum + 1,
						Column:  colNum + 1,
					}
				}
				stack = stack[:len(stack)-1]
			case ']':
				if len(stack) == 0 || stack[len(stack)-1] != '[' {
					return ValidationResult{
						Valid:   false,
						Message: fmt.Sprintf("Unmatched closing bracket ']' at line %d:%d", lineNum+1, colNum+1),
						Line:    lineNum + 1,
						Column:  colNum + 1,
					}
				}
				stack = stack[:len(stack)-1]
			case '}':
				if len(stack) == 0 || stack[len(stack)-1] != '{' {
					return ValidationResult{
						Valid:   false,
						Message: fmt.Sprintf("Unmatched closing brace '}' at line %d:%d", lineNum+1, colNum+1),
						Line:    lineNum + 1,
						Column:  colNum + 1,
					}
				}
				stack = stack[:len(stack)-1]
			}
		}
	}

	if len(stack) > 0 {
		unclosed := stack[len(stack)-1]
		return ValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("Unclosed delimiter '%c' in file", unclosed),
			Line:    len(lines),
		}
	}

	return ValidationResult{Valid: true, Message: "Syntax Validated (WASM Clean)"}
}

// FormatCode provides instant local text and code formatting without server roundtrips.
func FormatCode(code string, lang string) string {
	if strings.TrimSpace(code) == "" {
		return code
	}

	normLang := strings.ToLower(strings.TrimSpace(lang))

	// JSON Pretty Print
	if normLang == "json" {
		var obj any
		if err := json.Unmarshal([]byte(code), &obj); err == nil {
			if formatted, err := json.MarshalIndent(obj, "", "  "); err == nil {
				return string(formatted) + "\n"
			}
		}
	}

	lines := strings.Split(code, "\n")
	var formattedLines []string
	consecutiveBlanks := 0

	for _, line := range lines {
		trimmedRight := strings.TrimRight(line, " \t\r")
		if trimmedRight == "" {
			consecutiveBlanks++
			if consecutiveBlanks <= 2 {
				formattedLines = append(formattedLines, "")
			}
		} else {
			consecutiveBlanks = 0
			expanded := strings.ReplaceAll(trimmedRight, "\t", "    ")
			formattedLines = append(formattedLines, expanded)
		}
	}

	result := strings.Join(formattedLines, "\n")
	if !strings.HasSuffix(result, "\n") {
		result += "\n"
	}
	return result
}

// ComputeMetrics returns instant document metrics calculated in client WASM.
func ComputeMetrics(code string) CodeMetrics {
	lines := strings.Split(code, "\n")
	words := strings.Fields(code)

	nonEmpty := 0
	commentLines := 0

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			nonEmpty++
		}
		if strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "/*") {
			commentLines++
		}
	}

	return CodeMetrics{
		Lines:        len(lines),
		NonEmpty:     nonEmpty,
		Words:        len(words),
		Characters:   len([]rune(code)),
		Bytes:        len([]byte(code)),
		CommentLines: commentLines,
	}
}

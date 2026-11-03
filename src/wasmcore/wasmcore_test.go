package wasmcore

import (
	"strings"
	"testing"
)

func TestValidateCode(t *testing.T) {
	tests := []struct {
		name     string
		code     string
		lang     string
		expected bool
	}{
		{"Empty Code", "", "python", true},
		{"Valid Python Function", "def main():\n    print('hello')\n", "python", true},
		{"Invalid Python Missing Colon", "def main()\n    print('hello')\n", "python", false},
		{"Valid Braces", "function test() { return [1, 2, (3 + 4)]; }", "javascript", true},
		{"Unmatched Paren", "function test( { return 1; }", "javascript", false},
		{"Unmatched Bracket", "const arr = [1, 2, 3;", "javascript", false},
		{"Valid JSON", `{"key": "value", "count": 42}`, "json", true},
		{"Invalid JSON", `{"key": "value",}`, "json", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ValidateCode(tt.code, tt.lang)
			if res.Valid != tt.expected {
				t.Errorf("ValidateCode(%q, %q) = %v; expected %v (msg: %s)", tt.code, tt.lang, res.Valid, tt.expected, res.Message)
			}
		})
	}
}

func TestFormatCode(t *testing.T) {
	// Test trailing whitespace and tab expansion
	input := "def hello():\t\n    x = 1   \n\n\n\n    return x\t"
	formatted := FormatCode(input, "python")

	if strings.Contains(formatted, "\t") {
		t.Errorf("expected tabs to be expanded, found tabs")
	}
	if strings.Contains(formatted, "   \n") {
		t.Errorf("expected trailing whitespace to be trimmed")
	}

	// Test JSON formatting
	jsonInput := `{"a":1,"b":[2,3]}`
	formattedJSON := FormatCode(jsonInput, "json")
	if !strings.Contains(formattedJSON, "  \"a\": 1") {
		t.Errorf("expected indented JSON, got: %s", formattedJSON)
	}
}

func TestComputeMetrics(t *testing.T) {
	code := "# Comment line\ndef add(a, b):\n    return a + b\n"
	metrics := ComputeMetrics(code)

	if metrics.Lines < 3 {
		t.Errorf("expected at least 3 lines, got %d", metrics.Lines)
	}
	if metrics.CommentLines != 1 {
		t.Errorf("expected 1 comment line, got %d", metrics.CommentLines)
	}
	if metrics.Words != 10 {
		t.Errorf("expected 10 words, got %d", metrics.Words)
	}
}

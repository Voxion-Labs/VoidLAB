//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/Voxion-Labs/VoidLAB/internal/wasmcore"
)

func main() {
	c := make(chan struct{}, 0)

	// Expose voidlabWASM namespace onto global window object
	js.Global().Set("voidlabWASM", js.ValueOf(map[string]any{
		"validate": js.FuncOf(validateJS),
		"format":   js.FuncOf(formatJS),
		"metrics":  js.FuncOf(metricsJS),
		"isReady":  js.FuncOf(isReadyJS),
		"version":  js.ValueOf("0.1.0-wasm"),
	}))

	fmt.Println("[VoidLAB WASM] Client-side WebAssembly Engine Active (sub-millisecond non-blocking runtime)")

	// Keep runtime alive for subsequent event callbacks
	<-c
}

func isReadyJS(this js.Value, args []js.Value) any {
	return js.ValueOf(true)
}

func validateJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return toJSONValue(wasmcore.ValidationResult{Valid: true, Message: "empty input"})
	}

	code := args[0].String()
	lang := "python"
	if len(args) > 1 {
		lang = strings.ToLower(args[1].String())
	}

	res := wasmcore.ValidateCode(code, lang)
	return toJSONValue(res)
}

func formatJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return js.ValueOf("")
	}
	code := args[0].String()
	lang := "python"
	if len(args) > 1 {
		lang = strings.ToLower(args[1].String())
	}

	formatted := wasmcore.FormatCode(code, lang)
	return js.ValueOf(formatted)
}

func metricsJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return toJSONValue(wasmcore.CodeMetrics{})
	}
	code := args[0].String()
	m := wasmcore.ComputeMetrics(code)
	return toJSONValue(m)
}

func toJSONValue(v any) any {
	b, err := json.Marshal(v)
	if err != nil {
		return js.ValueOf("{}")
	}
	return js.Global().Get("JSON").Call("parse", string(b))
}

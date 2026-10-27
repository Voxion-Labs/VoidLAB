package main

import (
	"fmt"
	"os"
)

const (
	// Version of the VoidLAB engine
	Version = "0.1.0"
	// Banner displayed on initialization
	Banner = "VoidLAB Engine v" + Version + " - High-Performance Local-First Cloud IDE"
)

func run() error {
	return nil
}

func main() {
	fmt.Println(Banner)
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

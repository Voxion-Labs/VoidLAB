export type LanguageOption = {
  id: string;
  label: string;
  category: string;
  description: string;
  extension: string;
  executionLabel?: string;
  judge0Id?: number;
  monacoLanguage: string;
  previewable?: boolean;
  runnable: boolean;
  runtimeLabel?: string;
  template: string;
};

const runnableLanguages: LanguageOption[] = [
  {
    id: "javascript",
    label: "JavaScript",
    category: "Web",
    description: "Fast scripting for modern web apps and tooling.",
    executionLabel: "Judge0 CE • Node.js 22",
    extension: "js",
    judge0Id: 102,
    monacoLanguage: "javascript",
    runnable: true,
    runtimeLabel: "Node.js 22 runtime",
    template: 'console.log("Welcome to VoidLAB");\n',
  },
  {
    id: "typescript",
    label: "TypeScript",
    category: "Web",
    description: "Typed JavaScript for scalable apps and services.",
    executionLabel: "Judge0 CE • TypeScript 5.6",
    extension: "ts",
    judge0Id: 101,
    monacoLanguage: "typescript",
    runnable: true,
    runtimeLabel: "TypeScript 5.6 runtime",
    template: 'const greeting: string = "Welcome to VoidLAB";\nconsole.log(greeting);\n',
  },
  {
    id: "python",
    label: "Python",
    category: "General",
    description: "Readable, versatile, and ideal for automation or ML.",
    executionLabel: "Judge0 CE • Python 3.13",
    extension: "py",
    judge0Id: 109,
    monacoLanguage: "python",
    runnable: true,
    runtimeLabel: "Python 3.13 runtime",
    template:
      'age = int(input().strip())\nname = input().strip()\n\nprint(f"Age: {age}")\nprint(f"Name: {name}")\n',
  },
  {
    id: "java",
    label: "Java",
    category: "Enterprise",
    description: "Strongly typed language for large backend systems.",
    executionLabel: "Judge0 CE • Java 17",
    extension: "java",
    judge0Id: 91,
    monacoLanguage: "java",
    runnable: true,
    runtimeLabel: "Java 17 runtime",
    template:
      'class Main {\n  public static void main(String[] args) {\n    System.out.println("Welcome to VoidLAB");\n  }\n}\n',
  },
  {
    id: "c",
    label: "C",
    category: "Systems",
    description: "Classic systems programming language.",
    executionLabel: "Judge0 CE • GCC 14",
    extension: "c",
    judge0Id: 103,
    monacoLanguage: "c",
    runnable: true,
    runtimeLabel: "GCC 14 compiler",
    template:
      '#include <stdio.h>\n\nint main() {\n  printf("Welcome to VoidLAB\\n");\n  return 0;\n}\n',
  },
  {
    id: "cpp",
    label: "C++",
    category: "Systems",
    description: "High-performance language for large applications.",
    executionLabel: "Judge0 CE • GCC 14",
    extension: "cpp",
    judge0Id: 105,
    monacoLanguage: "cpp",
    runnable: true,
    runtimeLabel: "GCC 14 compiler with -std=c++26",
    template:
      '#include <iostream>\n#include <limits>\n#include <string>\n\nusing namespace std;\n\nint main() {\n  int age = 0;\n  string name;\n\n  cin >> age;\n  cin.ignore(numeric_limits<streamsize>::max(), \'\\n\');\n  getline(cin, name);\n\n  cout << "Age: " << age << \'\\n\';\n  cout << "Name: " << name << \'\\n\';\n  return 0;\n}\n',
  },
  {
    id: "go",
    label: "Go",
    category: "Backend",
    description: "Simple and efficient language for cloud services.",
    executionLabel: "Judge0 CE • Go 1.23",
    extension: "go",
    judge0Id: 107,
    monacoLanguage: "go",
    runnable: true,
    runtimeLabel: "Go 1.23 runtime",
    template:
      'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Welcome to VoidLAB")\n}\n',
  },
  {
    id: "rust",
    label: "Rust",
    category: "Systems",
    description: "Memory-safe systems programming with strong performance.",
    executionLabel: "Judge0 CE • Rust 1.85",
    extension: "rs",
    judge0Id: 108,
    monacoLanguage: "rust",
    runnable: true,
    runtimeLabel: "Rust 1.85 toolchain",
    template: 'fn main() {\n    println!("Welcome to VoidLAB");\n}\n',
  },
  {
    id: "php",
    label: "PHP",
    category: "Web",
    description: "Server-side scripting for dynamic web apps.",
    executionLabel: "Judge0 CE • PHP 8.3",
    extension: "php",
    judge0Id: 98,
    monacoLanguage: "php",
    runnable: true,
    runtimeLabel: "PHP 8.3 runtime",
    template: '<?php\necho "Welcome to VoidLAB";\n',
  },
  {
    id: "ruby",
    label: "Ruby",
    category: "Web",
    description: "Expressive language for productive app development.",
    executionLabel: "Judge0 CE • Ruby 2.7",
    extension: "rb",
    judge0Id: 72,
    monacoLanguage: "ruby",
    runnable: true,
    runtimeLabel: "Ruby 2.7 runtime",
    template: 'puts "Welcome to VoidLAB"\n',
  },
  {
    id: "swift",
    label: "Swift",
    category: "Mobile",
    description: "Modern Apple-platform language with clean syntax.",
    executionLabel: "Judge0 CE • Swift 5.2",
    extension: "swift",
    judge0Id: 83,
    monacoLanguage: "swift",
    runnable: true,
    runtimeLabel: "Swift 5.2 runtime",
    template: 'print("Welcome to VoidLAB")\n',
  },
  {
    id: "kotlin",
    label: "Kotlin",
    category: "Mobile",
    description: "Concise JVM language used across Android and backend.",
    executionLabel: "Judge0 CE • Kotlin 2.1",
    extension: "kt",
    judge0Id: 111,
    monacoLanguage: "kotlin",
    runnable: true,
    runtimeLabel: "Kotlin 2.1 runtime",
    template: 'fun main() {\n  println("Welcome to VoidLAB")\n}\n',
  },
  {
    id: "bash",
    label: "Bash",
    category: "Scripting",
    description: "Shell scripting for automation and operations.",
    executionLabel: "Judge0 CE • Bash 5",
    extension: "sh",
    judge0Id: 46,
    monacoLanguage: "shell",
    runnable: true,
    runtimeLabel: "Bash 5 runtime",
    template: 'echo "Welcome to VoidLAB"\n',
  },
  {
    id: "powershell",
    label: "PowerShell",
    category: "Scripting",
    description: "Task automation language for modern ops workflows. Editing is supported; cloud execution is not currently exposed by the public runtime provider.",
    extension: "ps1",
    monacoLanguage: "powershell",
    runnable: false,
    runtimeLabel: "Editor support only",
    template: 'Write-Output "Welcome to VoidLAB"\n',
  },
  {
    id: "lua",
    label: "Lua",
    category: "Embedded",
    description: "Lightweight language used in games and embedded apps.",
    executionLabel: "Judge0 CE • Lua 5.3",
    extension: "lua",
    judge0Id: 64,
    monacoLanguage: "lua",
    runnable: true,
    runtimeLabel: "Lua 5.3 runtime",
    template: 'print("Welcome to VoidLAB")\n',
  },
  {
    id: "csharp",
    label: "C#",
    category: "Enterprise",
    description: "Managed language for .NET and enterprise applications.",
    executionLabel: "Judge0 CE • Mono C#",
    extension: "cs",
    judge0Id: 51,
    monacoLanguage: "csharp",
    runnable: true,
    runtimeLabel: "Mono C# runtime",
    template:
      'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Welcome to VoidLAB");\n  }\n}\n',
  },
];

const editorOnlyLanguages: LanguageOption[] = [
  {
    id: "html",
    label: "HTML",
    category: "Markup",
    description: "Markup for page structure.",
    extension: "html",
    monacoLanguage: "html",
    previewable: true,
    runnable: false,
    template: "<section>\n  <h1>Welcome to VoidLAB</h1>\n</section>\n",
  },
  {
    id: "css",
    label: "CSS",
    category: "Markup",
    description: "Styling language for web interfaces.",
    extension: "css",
    monacoLanguage: "css",
    previewable: true,
    runnable: false,
    template: "body {\n  background: #030712;\n  color: white;\n}\n",
  },
  {
    id: "json",
    label: "JSON",
    category: "Data",
    description: "Structured data format.",
    extension: "json",
    monacoLanguage: "json",
    previewable: true,
    runnable: false,
    template: '{\n  "product": "VoidLAB",\n  "status": "ready"\n}\n',
  },
  {
    id: "markdown",
    label: "Markdown",
    category: "Docs",
    description: "Documentation-friendly lightweight markup.",
    extension: "md",
    monacoLanguage: "markdown",
    previewable: true,
    runnable: false,
    template: "# VoidLAB\n\nBuild, run, and ship from the cloud.\n",
  },
  {
    id: "yaml",
    label: "YAML",
    category: "Data",
    description: "Readable config format for pipelines and apps.",
    extension: "yml",
    monacoLanguage: "yaml",
    runnable: false,
    template: "name: voidlab\nstatus: ready\n",
  },
  {
    id: "sql",
    label: "SQL",
    category: "Data",
    description: "Query language for relational databases.",
    extension: "sql",
    monacoLanguage: "sql",
    runnable: false,
    template: "select 'Welcome to VoidLAB' as message;\n",
  },
  {
    id: "xml",
    label: "XML",
    category: "Markup",
    description: "Structured markup for document-style data.",
    extension: "xml",
    monacoLanguage: "xml",
    previewable: true,
    runnable: false,
    template: "<message>Welcome to VoidLAB</message>\n",
  },
];

export const languageGroups = [
  { label: "Runnable languages", items: runnableLanguages },
  { label: "Editor-only formats", items: editorOnlyLanguages },
];

export const allLanguages = [...runnableLanguages, ...editorOnlyLanguages];
export const DEFAULT_LANGUAGE = runnableLanguages[0];

export const getLanguageById = (id: string) =>
  allLanguages.find((item) => item.id === id) ?? DEFAULT_LANGUAGE;

export const getLanguageByExtension = (value: string) => {
  const extension = value.includes(".") ? value.split(".").pop()?.toLowerCase() ?? "" : value.toLowerCase();

  return (
    allLanguages.find((item) => item.extension.toLowerCase() === extension) ?? DEFAULT_LANGUAGE
  );
};

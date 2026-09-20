export type InteractiveExecutionPlan = {
  autoSubmit: boolean;
  expectedInputCount: number | null;
  prompts: string[];
  requiresInput: boolean;
  summary: string;
};

const maxAutoPromptCount = 8;

const countMatches = (value: string, expression: RegExp) => value.match(expression)?.length ?? 0;

const normalizePromptText = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .trim();

const extractLiteralPrompts = (source: string, expression: RegExp) =>
  Array.from(source.matchAll(expression))
    .map((match) => normalizePromptText(match[2] ?? ""))
    .filter(Boolean);

const buildGenericPrompts = (count: number) =>
  Array.from({ length: Math.max(1, count) }, (_, index) => `stdin[${index + 1}]`);

const buildPlan = (count: number, literalPrompts: string[], fallbackSummary: string) => {
  if (count <= 0 && literalPrompts.length === 0) {
    return {
      autoSubmit: false,
      expectedInputCount: null,
      prompts: [],
      requiresInput: false,
      summary: fallbackSummary,
    } satisfies InteractiveExecutionPlan;
  }

  const expectedInputCount = count > 0 ? count : null;
  const normalizedCount =
    expectedInputCount && expectedInputCount <= maxAutoPromptCount ? expectedInputCount : literalPrompts.length;
  const prompts =
    literalPrompts.length > 0
      ? Array.from({ length: normalizedCount || literalPrompts.length }, (_, index) => {
          const literal = literalPrompts[index];
          return literal || `stdin[${index + 1}]`;
        })
      : buildGenericPrompts(normalizedCount || 1);

  return {
    autoSubmit: Boolean(expectedInputCount && expectedInputCount <= maxAutoPromptCount),
    expectedInputCount,
    prompts,
    requiresInput: true,
    summary:
      expectedInputCount && expectedInputCount <= maxAutoPromptCount
        ? `This program appears to need ${expectedInputCount} stdin ${expectedInputCount === 1 ? "line" : "lines"} before it can run.`
        : "This program appears to read stdin. Enter the required values in the Output panel, then run it.",
  } satisfies InteractiveExecutionPlan;
};

export const analyzeInteractiveExecution = (languageId: string, source: string): InteractiveExecutionPlan => {
  switch (languageId) {
    case "python": {
      const prompts = extractLiteralPrompts(source, /\binput\s*\(\s*(['"`])([\s\S]*?)\1/g);
      return buildPlan(
        countMatches(source, /\binput\s*\(/g) +
          countMatches(source, /\bsys\.stdin\.readline\s*\(/g) +
          countMatches(source, /\bsys\.stdin\.read\s*\(/g),
        prompts,
        "Python execution is ready.",
      );
    }
    case "javascript":
    case "typescript": {
      const promptCalls = extractLiteralPrompts(
        source,
        /\b(?:window\.)?prompt\s*\(\s*(['"`])([\s\S]*?)\1/g,
      );
      const questionCalls = extractLiteralPrompts(
        source,
        /\bquestion\s*\(\s*(['"`])([\s\S]*?)\1/g,
      );
      const count =
        countMatches(source, /\b(?:window\.)?prompt\s*\(/g) + countMatches(source, /\bquestion\s*\(/g);

      if (count > 0 || promptCalls.length > 0 || questionCalls.length > 0) {
        return buildPlan(count, [...promptCalls, ...questionCalls], "JavaScript execution is ready.");
      }

      if (/readline(?:\/promises)?|createInterface\s*\(|process\.stdin/i.test(source)) {
        return {
          autoSubmit: false,
          expectedInputCount: null,
          prompts: ["stdin[1]"],
          requiresInput: true,
          summary: "This program appears to stream stdin. Enter the required values in the Output panel, then run it.",
        };
      }

      return buildPlan(0, [], "JavaScript execution is ready.");
    }
    case "cpp":
    case "c":
      return buildPlan(
        countMatches(source, /\bcin\s*>>/g) +
          countMatches(source, /\bscanf(?:_s)?\s*\(/g) +
          countMatches(source, /\bgetline\s*\(/g) +
          countMatches(source, /\bfgets\s*\(/g),
        [],
        "C/C++ execution is ready.",
      );
    case "java":
      return buildPlan(
        countMatches(source, /\bnext(?:Line|Int|Long|Double|Float|Boolean)\s*\(/g) +
          countMatches(source, /\breadLine\s*\(/g),
        [],
        "Java execution is ready.",
      );
    case "csharp":
      return buildPlan(countMatches(source, /\bConsole\.ReadLine\s*\(/gi), [], "C# execution is ready.");
    case "go":
      return buildPlan(
        countMatches(source, /\bfmt\.Scan(?:ln|f)?\s*\(/g) + countMatches(source, /\bNewScanner\s*\(/g),
        [],
        "Go execution is ready.",
      );
    case "rust":
      return buildPlan(
        countMatches(source, /\bstdin\s*\(\)/g) + countMatches(source, /\bread_line\s*\(/g),
        [],
        "Rust execution is ready.",
      );
    case "php":
      return buildPlan(
        countMatches(source, /\breadline\s*\(/gi) + countMatches(source, /\bfgets\s*\(\s*STDIN/gi),
        [],
        "PHP execution is ready.",
      );
    case "ruby":
      return buildPlan(
        countMatches(source, /\bgets\b/g) + countMatches(source, /\breadline\b/g),
        [],
        "Ruby execution is ready.",
      );
    case "swift":
      return buildPlan(countMatches(source, /\breadLine\s*\(/g), [], "Swift execution is ready.");
    case "kotlin":
      return buildPlan(
        countMatches(source, /\breadln\s*\(/g) + countMatches(source, /\breadLine\s*\(/g),
        [],
        "Kotlin execution is ready.",
      );
    case "bash":
      return buildPlan(countMatches(source, /\bread\s+[-\w ]+\w/gi), [], "Shell execution is ready.");
    case "lua":
      return buildPlan(countMatches(source, /\bio\.read\s*\(/g), [], "Lua execution is ready.");
    default:
      return {
        autoSubmit: false,
        expectedInputCount: null,
        prompts: [],
        requiresInput: false,
        summary: "Execution is ready.",
      };
  }
};

export const serializeStdinLines = (lines: string[]) =>
  lines.length ? lines.map((line) => `${line}\n`).join("") : "";

export const countBufferedStdinLines = (stdin: string) => {
  if (!stdin.length) return 0;

  const lines = stdin.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.length;
};

export const hasBufferedStdin = (stdin: string) => countBufferedStdinLines(stdin) > 0;

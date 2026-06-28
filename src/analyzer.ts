import { ModelRouter } from "./modelRouter";
import { CrawlerIssue } from "./crawler";
import { randomUUID } from "crypto";

export async function analyzeFile(
  content: string,
  path: string,
  router: ModelRouter
): Promise<CrawlerIssue[]> {
  const prompt = `
You are Crawler, an agentic static analyzer.

Analyze this file for bugs, warnings, smells, and risky patterns.
Return ONLY a JSON array of issues. Each issue must include:

{
  "file": "string",
  "line": number,
  "type": "bug" | "warning" | "smell",
  "message": "string",
  "snippet": "string",
  "suggestion": "string"
}

File path: ${path}

Code:
${content}
`;

  const raw = await router.askModel(prompt);

  try {
    const parsed = JSON.parse(raw);
    return parsed.map((i: any) => ({
      id: randomUUID(),
      file: i.file || path,
      line: i.line || 1,
      type: i.type || "warning",
      message: i.message || "Unknown issue",
      snippet: i.snippet || "",
      suggestion: i.suggestion || ""
    }));
  } catch {
    return [];
  }
}

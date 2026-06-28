import { ModelRouter } from "./modelRouter";
import { CrawlerIssue, CrawlerFix } from "./crawler";

export async function generateFix(
  issue: CrawlerIssue,
  router: ModelRouter
): Promise<CrawlerFix> {
  const prompt = `
You are Crawler Fixer.

Generate a unified diff patch to fix this issue:

${JSON.stringify(issue, null, 2)}

The diff must be in standard unified format:

diff --git a/${issue.file} b/${issue.file}
@@ -old,+new @@
- old line
+ new line

Only output the diff. No explanation.
`;

  const diff = await router.askModel(prompt);

  return {
    issueId: issue.id,
    file: issue.file,
    diff
  };
}

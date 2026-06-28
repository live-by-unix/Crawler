import * as vscode from "vscode";
import { analyzeFile } from "./analyzer";
import { generateFix } from "./fixer";
import { applyDiffToFile, readFile } from "./utils";
import { ModelRouter } from "./modelRouter";

export interface CrawlerIssue {
  id: string;
  file: string;
  line: number;
  type: string;
  message: string;
  snippet: string;
  suggestion: string;
}

export interface CrawlerFix {
  issueId: string;
  file: string;
  diff: string;
}

export class Crawler {
  private context: vscode.ExtensionContext;
  private router: ModelRouter;
  private statusBar: vscode.StatusBarItem;
  private issues: CrawlerIssue[] = [];
  private fixes: CrawlerFix[] = [];
  private selectedIssueId: string | null = null;

  constructor(context: vscode.ExtensionContext, router: ModelRouter) {
    this.context = context;
    this.router = router;
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  }

  initStatusBar() {
    this.statusBar.text = "Crawler: Idle";
    this.statusBar.show();
  }

  getIssues() {
    return this.issues;
  }

  setSelectedIssue(id: string) {
    this.selectedIssueId = id;
  }

  async scanWorkspace() {
    this.statusBar.text = "Crawler: Scanning…";

    const files = await vscode.workspace.findFiles("**/*.{js,ts,jsx,tsx,py,go,rs}");
    const allIssues: CrawlerIssue[] = [];

    for (const file of files) {
      const content = await readFile(file.fsPath);
      const fileIssues = await analyzeFile(content, file.fsPath, this.router);
      allIssues.push(...fileIssues);
    }

    this.issues = allIssues;
    this.fixes = [];

    this.statusBar.text = `Crawler: ${allIssues.length} issues`;
    vscode.window.showInformationMessage(`Crawler found ${allIssues.length} issues.`);
  }

  async applySelectedFix() {
    if (!this.selectedIssueId) {
      vscode.window.showWarningMessage("Crawler: No issue selected.");
      return;
    }

    const issue = this.issues.find((i) => i.id === this.selectedIssueId);
    if (!issue) {
      vscode.window.showWarningMessage("Crawler: Issue not found.");
      return;
    }

    const fix = await generateFix(issue, this.router);
    this.fixes.push(fix);

    const confirm = await vscode.window.showInformationMessage(
      `Apply fix for ${issue.file}:${issue.line}?`,
      "Apply",
      "Cancel"
    );

    if (confirm === "Apply") {
      await applyDiffToFile(fix.file, fix.diff);
      vscode.window.showInformationMessage("Crawler: Fix applied.");
    }
  }

  async explainSelectedIssue() {
    if (!this.selectedIssueId) {
      vscode.window.showWarningMessage("Crawler: No issue selected.");
      return;
    }

    const issue = this.issues.find((i) => i.id === this.selectedIssueId);
    if (!issue) {
      vscode.window.showWarningMessage("Crawler: Issue not found.");
      return;
    }

    const explanation = await this.router.askModel(
      `Explain this issue in detail:\n\n${JSON.stringify(issue, null, 2)}`
    );

    vscode.window.showInformationMessage(explanation);
  }
}

import * as vscode from "vscode";
import { Crawler, CrawlerIssue } from "./crawler";
import { ModelRouter, ProviderConfig, LocalModelConfig, ApiModelConfig } from "./modelRouter";

export class CrawlerSidebarProvider implements vscode.TreeDataProvider<CrawlerItem> {
  private crawler: Crawler;
  private router: ModelRouter;
  private _onDidChangeTreeData: vscode.EventEmitter<CrawlerItem | undefined | void> =
    new vscode.EventEmitter<CrawlerItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<CrawlerItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(crawler: Crawler, router: ModelRouter) {
    this.crawler = crawler;
    this.router = router;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CrawlerItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CrawlerItem): Thenable<CrawlerItem[]> {
    if (!element) {
      const rootItems: CrawlerItem[] = [];

      rootItems.push(
        new CrawlerItem("Issues", vscode.TreeItemCollapsibleState.Expanded, "root:issues")
      );
      rootItems.push(
        new CrawlerItem("Providers", vscode.TreeItemCollapsibleState.Expanded, "root:providers")
      );

      return Promise.resolve(rootItems);
    }

    if (element.id === "root:issues") {
      const issues = this.crawler.getIssues();
      return Promise.resolve(
        issues.map(
          (i) =>
            new CrawlerItem(
              `${i.type.toUpperCase()}: ${i.message}`,
              vscode.TreeItemCollapsibleState.None,
              "issue",
              i
            )
        )
      );
    }

    if (element.id === "root:providers") {
      const providers = this.router.getProviders();
      const items: CrawlerItem[] = providers.map((p, idx) => {
        const label =
          p.type === "local"
            ? `Local: ${(p as LocalModelConfig).model} (port ${(p as LocalModelConfig).port})`
            : `API: ${(p as ApiModelConfig).name} (${(p as ApiModelConfig).model})`;
        return new CrawlerItem(label, vscode.TreeItemCollapsibleState.None, "provider", undefined, idx, p);
      });

      items.push(
        new CrawlerItem(
          "+ Add Local Provider",
          vscode.TreeItemCollapsibleState.None,
          "action:addLocal"
        )
      );
      items.push(
        new CrawlerItem(
          "+ Add API Provider",
          vscode.TreeItemCollapsibleState.None,
          "action:addApi"
        )
      );
      items.push(
        new CrawlerItem(
          "⚡ Benchmark Providers",
          vscode.TreeItemCollapsibleState.None,
          "action:benchmark"
        )
      );

      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }
}

class CrawlerItem extends vscode.TreeItem {
  kind:
    | "root:issues"
    | "root:providers"
    | "issue"
    | "provider"
    | "action:addLocal"
    | "action:addApi"
    | "action:benchmark";
  issue?: CrawlerIssue;
  provider?: ProviderConfig;
  providerIndex?: number;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    kind: CrawlerItem["kind"],
    issue?: CrawlerIssue,
    providerIndex?: number,
    provider?: ProviderConfig
  ) {
    super(label, collapsibleState);
    this.kind = kind;
    this.issue = issue;
    this.providerIndex = providerIndex;
    this.provider = provider;
    this.id = typeof kind === "string" && kind.startsWith("root") ? kind : undefined;

    if (kind === "issue" && issue) {
      this.description = `${issue.file}:${issue.line}`;
      this.command = {
        command: "crawler.explainIssue",
        title: "Explain Issue",
        arguments: [issue]
      };
      this.tooltip = `${issue.suggestion}\n\n${issue.snippet}`;
    }

    if (kind === "action:addLocal") {
      this.command = {
        command: "crawler.addLocalProvider",
        title: "Add Local Provider"
      };
    }

    if (kind === "action:addApi") {
      this.command = {
        command: "crawler.addApiProvider",
        title: "Add API Provider"
      };
    }

    if (kind === "action:benchmark") {
      this.command = {
        command: "crawler.benchmarkProviders",
        title: "Benchmark Providers"
      };
    }
  }
}

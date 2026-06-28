import * as vscode from "vscode";
import { Crawler } from "./crawler";
import { CrawlerSidebarProvider } from "./ui";
import { ModelRouter } from "./modelRouter";

let crawler: Crawler | null = null;
let router: ModelRouter | null = null;
let sidebarProvider: CrawlerSidebarProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
  router = new ModelRouter();
  crawler = new Crawler(context, router);
  sidebarProvider = new CrawlerSidebarProvider(crawler, router);

  context.subscriptions.push(
    vscode.commands.registerCommand("crawler.scan", () => crawler?.scanWorkspace()),
    vscode.commands.registerCommand("crawler.applyFix", () => crawler?.applySelectedFix()),
    vscode.commands.registerCommand("crawler.explainIssue", () => crawler?.explainSelectedIssue()),
    vscode.commands.registerCommand("crawler.addLocalProvider", () =>
      router?.addLocalProvider().then(() => sidebarProvider?.refresh())
    ),
    vscode.commands.registerCommand("crawler.addApiProvider", () =>
      router?.addApiProvider().then(() => sidebarProvider?.refresh())
    ),
    vscode.commands.registerCommand("crawler.benchmarkProviders", () =>
      router?.benchmarkProviders()
    ),
    vscode.window.registerTreeDataProvider("crawlerSidebar", sidebarProvider!)
  );

  crawler!.initStatusBar();
}

export function deactivate() {}

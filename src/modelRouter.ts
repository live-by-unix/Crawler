import * as vscode from "vscode";
import fetch from "node-fetch";

export interface LocalModelConfig {
  type: "local";
  port: number;
  model: string;
}

export interface ApiModelConfig {
  type: "api";
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers: Record<string, string>;
  params: Record<string, any>;
}

export type ProviderConfig = LocalModelConfig | ApiModelConfig;

export class ModelRouter {
  private providers: ProviderConfig[] = [];

  constructor() {
    this.loadConfig();
  }

  getProviders() {
    return this.providers;
  }

  private loadConfig() {
    const saved = vscode.workspace.getConfiguration("crawler").get("providers") as any[];
    if (saved) this.providers = saved;
  }

  private saveConfig() {
    vscode.workspace.getConfiguration("crawler").update("providers", this.providers, true);
  }

  async addLocalProvider() {
    const portStr = await vscode.window.showInputBox({
      prompt: "Enter local model port (e.g., 11434)",
      validateInput: (v) => (isNaN(Number(v)) ? "Must be a number" : null)
    });
    if (!portStr) return;

    const port = Number(portStr);

    let models: string[] = [];
    try {
      const res = await fetch(`http://localhost:${port}/api/tags`);
      const data: any = await res.json();
      models = data?.models?.map((m: any) => m.name) || [];
    } catch {
      vscode.window.showErrorMessage("Could not scan local models.");
      return;
    }

    const model = await vscode.window.showQuickPick(models, {
      placeHolder: "Select a local model"
    });
    if (!model) return;

    const config: LocalModelConfig = {
      type: "local",
      port,
      model
    };

    this.providers.push(config);
    this.saveConfig();

    vscode.window.showInformationMessage(`Added local provider: ${model}`);
  }

  async addApiProvider() {
    const name = await vscode.window.showInputBox({
      prompt: "Provider name (e.g., Claude, Groq, OpenAI)"
    });
    if (!name) return;

    const baseUrl = await vscode.window.showInputBox({
      prompt: "Base URL (e.g., https://api.anthropic.com/v1/messages)"
    });
    if (!baseUrl) return;

    const apiKey = await vscode.window.showInputBox({
      prompt: "API Key (optional)",
      password: true
    });

    const model = await vscode.window.showInputBox({
      prompt: "Model name (e.g., claude-3-sonnet, llama-3-70b)"
    });
    if (!model) return;

    const headersInput = await vscode.window.showInputBox({
      prompt: "Custom headers (JSON, optional)",
      placeHolder: '{"x-api-key":"KEY","anthropic-version":"2023-06-01"}'
    });

    let headers: Record<string, string> = {};
    if (headersInput) {
      try {
        headers = JSON.parse(headersInput);
      } catch {
        vscode.window.showErrorMessage("Invalid JSON for headers.");
      }
    }

    const paramsInput = await vscode.window.showInputBox({
      prompt: "Extra params (JSON, optional)",
      placeHolder: '{"temperature":0.2,"max_tokens":2048}'
    });

    let params: Record<string, any> = {};
    if (paramsInput) {
      try {
        params = JSON.parse(paramsInput);
      } catch {
        vscode.window.showErrorMessage("Invalid JSON for params.");
      }
    }

    const config: ApiModelConfig = {
      type: "api",
      name,
      baseUrl,
      apiKey,
      model,
      headers,
      params
    };

    this.providers.push(config);
    this.saveConfig();

    vscode.window.showInformationMessage(`Added API provider: ${name}`);
  }

  async benchmarkProviders() {
    if (!this.providers.length) {
      vscode.window.showWarningMessage("Crawler: No providers configured.");
      return;
    }

    const prompt = "Benchmark: respond with the single word 'OK'.";
    const results: string[] = [];

    for (const p of this.providers) {
      const start = Date.now();
      try {
        const res = await this.callProvider(p, prompt);
        const ms = Date.now() - start;
        results.push(
          `${p.type === "local" ? `local:${p.model}` : `api:${p.name}`} → ${ms}ms (${res.slice(
            0,
            20
          )}...)`
        );
      } catch (e: any) {
        results.push(
          `${p.type === "local" ? `local:${p.model}` : `api:${p.name}`} → ERROR: ${e}`
        );
      }
    }

    vscode.window.showInformationMessage("Crawler benchmark:\n" + results.join("\n"));
  }

  async askModel(prompt: string): Promise<string> {
    if (this.providers.length === 0) {
      vscode.window.showErrorMessage("No providers configured.");
      return "";
    }

    if (this.providers.length === 1) {
      return this.callProvider(this.providers[0], prompt);
    }

    const results = await Promise.all(
      this.providers.map((p) =>
        this.callProvider(p, prompt).catch((e) => `ERROR: ${e}`)
      )
    );

    const mergePrompt = `
You are Crawler Swarm Aggregator.
Merge these model outputs into one best answer:

${results
  .map(
    (r, i) =>
      `Provider ${this.providers[i].type} (${
        this.providers[i].type === "local"
          ? (this.providers[i] as LocalModelConfig).model
          : (this.providers[i] as ApiModelConfig).name
      }):\n${r}\n`
  )
  .join("\n")}
`;

    return this.callProvider(this.providers[0], mergePrompt);
  }

  private async callProvider(provider: ProviderConfig, prompt: string): Promise<string> {
    if (provider.type === "local") {
      return this.callLocal(provider, prompt);
    } else {
      return this.callApi(provider, prompt);
    }
  }

  private async callLocal(provider: LocalModelConfig, prompt: string): Promise<string> {
    const res = await fetch(`http://localhost:${provider.port}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        prompt
      })
    });

    const data: any = await res.json();
    return data.response || JSON.stringify(data);
  }

  private async callApi(provider: ApiModelConfig, prompt: string): Promise<string> {
    const headers = {
      "Content-Type": "application/json",
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      ...provider.headers
    };

    const body = {
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      ...provider.params
    };

    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data: any = await res.json();

    return (
      data?.choices?.[0]?.message?.content ||
      data?.content?.[0]?.text ||
      JSON.stringify(data)
    );
  }
}

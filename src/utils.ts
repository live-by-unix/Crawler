import * as fs from "fs";
import * as vscode from "vscode";


const diff = require("diff");

export function log(...args: any[]) {
  console.log("[Crawler]", ...args);
}

export function readFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(data || "");
    });
  });
}

export async function applyDiffToFile(filePath: string, diffText: string) {
  const original = await readFile(filePath);

  // Parse unified diff
  const patches = diff.parsePatch(diffText);

  if (!patches.length) {
    vscode.window.showErrorMessage("Crawler: No patches found in diff.");
    return;
  }

  const patched = diff.applyPatch(original, patches[0]);

  if (!patched) {
    vscode.window.showErrorMessage("Crawler: Failed to apply patch.");
    return;
  }

  await fs.promises.writeFile(filePath, patched, "utf8");
}

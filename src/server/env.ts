import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function parseEnvFile(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return undefined;
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        if (!key) {
          return undefined;
        }

        return [key, unquote(rawValue)];
      })
      .filter((entry): entry is [string, string] => entry !== undefined)
  );
}

export function loadLocalEnv(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) {
    return;
  }

  const values = parseEnvFile(readFileSync(path, "utf8"));
  Object.entries(values).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

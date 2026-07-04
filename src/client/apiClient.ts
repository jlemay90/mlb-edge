export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;

  try {
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    const preview = text.trim().replace(/\s+/g, " ").slice(0, 140);
    throw new ApiResponseError(
      `API returned ${response.status} ${response.statusText || "response"} instead of JSON${preview ? `: ${preview}` : "."}`,
      response.status
    );
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `API request failed with status ${response.status}`;
    throw new ApiResponseError(message, response.status);
  }

  return body as T;
}

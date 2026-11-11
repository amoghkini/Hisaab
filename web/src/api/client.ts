/** An error answer from the API: {"error": {"code", "message", "details"}}. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Problems per field, from validation. */
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: { field?: string; message?: string }[] };
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const { error } = (await response.json()) as ErrorPayload;
    // A 404 without our error shape is a path the server does not know, usually a backend older than this page.
    if (!error && response.status === 404) {
      return new ApiError(404, "endpoint_not_found", "The server does not support this yet. It may need to be updated or restarted.");
    }
    const fields: Record<string, string> = {};
    for (const detail of error?.details ?? []) {
      if (detail.field && detail.message && !(detail.field in fields)) fields[detail.field] = detail.message;
    }
    return new ApiError(response.status, error?.code ?? "http_error", error?.message ?? response.statusText, fields);
  } catch {
    return new ApiError(response.status, "http_error", "Something went wrong on the server. Please try again.");
  }
}

export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin", // the session cookie
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Text that is safe to show a person. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) return "Something went wrong on the server. Please try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

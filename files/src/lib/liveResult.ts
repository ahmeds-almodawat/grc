export type LiveResult<T> =
  | { status: "success"; data: T }
  | { status: "empty"; data: null; message?: string }
  | { status: "error"; data: null; error: string }
  | { status: "forbidden"; data: null; reason: string };

export function liveSuccess<T>(data: T): LiveResult<T> {
  return { status: "success", data };
}

export function liveEmpty<T>(message?: string): LiveResult<T> {
  return { status: "empty", data: null, message };
}

export function liveError<T>(err: unknown): LiveResult<T> {
  return {
    status: "error",
    data: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

export function liveForbidden<T>(reason: string): LiveResult<T> {
  return { status: "forbidden", data: null, reason };
}

export function unwrapLiveResult<T>(result: LiveResult<T>, fallback: T): T {
  return result.status === "success" ? result.data : fallback;
}

export function assertLiveSuccess<T>(result: LiveResult<T>): T {
  if (result.status === "success") return result.data;

  if (result.status === "forbidden") {
    throw new Error(`Forbidden: ${result.reason}`);
  }

  if (result.status === "error") {
    throw new Error(result.error);
  }

  throw new Error(result.message ?? "Live data is empty.");
}

import type { AgentAdapter, ApprovalDecision, RetryPolicy } from "../protocol/stream";
import { ApiError } from "../protocol/stream";

export interface HttpOptions {
  /** Absolute or same-origin base, no trailing slash: "/api/v1". */
  baseUrl: string;
  /** Static or computed per request: an Authorization header, a tenant id. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  retry?: RetryPolicy | false;
  fetchImpl?: typeof fetch;
}

export async function resolveHeaders(headers: HttpOptions["headers"]): Promise<Record<string, string>> {
  return typeof headers === "function" ? await headers() : (headers ?? {});
}

/** JSON over HTTP for the endpoints around a run: health, sessions, approvals. */
export async function jsonRequest<T>(
  options: HttpOptions,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await doFetch(`${options.baseUrl}${path}`, {
    ...init,
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(await resolveHeaders(options.headers)),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(`${init.method ?? "GET"} ${path} failed`, response.status, body?.detail);
  }
  return (await response.json()) as T;
}

/** The optional methods most backends need, shared by every HTTP adapter. */
export function httpExtras(
  options: HttpOptions,
  paths: { health?: string; approval?: (id: string) => string } = {},
): Pick<AgentAdapter, "respond" | "health"> {
  return {
    health: paths.health
      ? async (signal) => {
          const body = await jsonRequest<{ status?: string; ready?: boolean; busy?: boolean; is_seeding?: boolean }>(
            options,
            paths.health as string,
            {},
            signal,
          );
          return { ready: body.ready ?? true, busy: body.busy ?? body.is_seeding ?? false };
        }
      : undefined,
    respond: paths.approval
      ? async (id: string, decision: ApprovalDecision, signal) => {
          await jsonRequest(options, (paths.approval as (id: string) => string)(id), {
            method: "POST",
            body: JSON.stringify({ decision }),
          }, signal);
        }
      : undefined,
  };
}

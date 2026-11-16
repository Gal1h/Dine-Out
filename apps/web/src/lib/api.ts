export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Options = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request(path: string, options: Options, retry = true): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body,
    signal: options.signal,
  });

  if (response.status === 401 && retry) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: { code?: string } } | null;
    const code = payload?.error?.code;
    if (code === "TOKEN_EXPIRED") {
      const ok = await refreshSession();
      if (ok) return request(path, options, false);
    }
    if (code === "TOKEN_EXPIRED" || code === "UNAUTHENTICATED") {
      window.dispatchEvent(new CustomEvent("dineout:session-expired"));
    }
  }

  return response;
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Terjadi kesalahan. Coba lagi.",
    );
  }

  return payload as T;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return unwrap<T>(await request(path, { method: "GET" }));
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    return unwrap<T>(await request(path, { method: "POST", body }));
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    return unwrap<T>(await request(path, { method: "PUT", body }));
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return unwrap<T>(await request(path, { method: "PATCH", body }));
  },
  async del<T>(path: string): Promise<T> {
    return unwrap<T>(await request(path, { method: "DELETE" }));
  },
  async upload<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
    return unwrap<T>(await request(path, { method, formData }));
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan. Coba lagi.";
}

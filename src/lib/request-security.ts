import { NativeAppError } from "./native-apps/errors.ts";

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function requireSameOrigin(request: Request) {
  if (!hasSameOrigin(request)) {
    throw new NativeAppError(
      "INVALID_ORIGIN",
      403,
      "This native app mutation requires a same-origin browser request.",
    );
  }
}

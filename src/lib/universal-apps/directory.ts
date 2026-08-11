// Relative + extensioned on purpose: this module is imported directly by the
// node --experimental-strip-types test runner, which does not resolve the "@/"
// alias. Keep it that way so the directory contract stays unit-testable.
import { selectUniversalRuntimeTarget } from "./cutover.ts";

/** A directory launch is derived only from an approved app's validated type. */
export function getUniversalAppLaunchPath(app: { isApproved: boolean; appType: string | null }): string | null {
  if (!app.isApproved) return null;
  if (!app.appType || !/^[a-z][a-z0-9-]{1,62}$/.test(app.appType)) return null;
  return `/app/${app.appType}`;
}

type DirectoryRelease = {
  status: string;
  deployments: Array<{ environment: string; status: string }>;
};

/**
 * Whether a listed app can actually be launched right now.
 *
 * `getUniversalAppLaunchPath` only proves the app *type* is well formed —
 * approval is not the same thing as being deployed. An approved app with no
 * provisioned runtime used to be advertised in the directory with a launch
 * badge, and clicking it sent the visitor through login only to land on
 * "app not available". The directory now asks the same question the launcher
 * does, using the same predicate (`selectUniversalRuntimeTarget`), so a card
 * only promises a launch when one exists.
 *
 * `releases` must be ordered newest-first, matching the launcher's query.
 */
export function canLaunchUniversalApp(
  app: { isApproved: boolean; appType: string | null },
  releases: readonly DirectoryRelease[] | undefined,
): boolean {
  if (!getUniversalAppLaunchPath(app)) return false;
  if (!releases || releases.length === 0) return false;
  return selectUniversalRuntimeTarget([...releases], app.isApproved).kind === "LAUNCH";
}

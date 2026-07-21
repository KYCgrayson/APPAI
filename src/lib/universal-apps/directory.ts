/** A directory launch is derived only from an approved app's validated type. */
export function getUniversalAppLaunchPath(app: { isApproved: boolean; appType: string | null }): string | null {
  if (!app.isApproved) return null;
  if (!app.appType || !/^[a-z][a-z0-9-]{1,62}$/.test(app.appType)) return null;
  return `/app/${app.appType}`;
}

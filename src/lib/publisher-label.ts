/** ADMIN ownership is the platform identity, irrespective of personal/org names. */
export function publisherLabel(organization: { name: string; users: { role: string }[] }): string {
  return organization.users.some(user => user.role === "ADMIN") ? "appai.info" : organization.name;
}

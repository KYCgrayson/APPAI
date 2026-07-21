export const redactManagedFailure = (value: string) => value.replace(/(postgres(?:ql)?:\/\/\S+|DATABASE_URL=\S+|VERCEL_OIDC_TOKEN=\S+)/gi, "[redacted]").slice(0, 500);
export type ManagedOrchestratorDeps = {
  markProvisioning(): Promise<void>; validate(): Promise<{ artifactDigest: string; capabilities: string[] }>; provisionDatabase(): Promise<{ migrationUrl: string; runtimeUrl: string }>;
  runMigration(url: string): Promise<void>; deploy(runtimeUrl?: string): Promise<{ providerProjectId: string; providerDeploymentId: string; publicRuntimeUrl: string }>;
  persistEvidence(value: { artifactDigest: string; providerProjectId: string; providerDeploymentId: string; publicRuntimeUrl: string }): Promise<void>;
  healthCheck(): Promise<void>; activate(capabilities: string[]): Promise<void>; fail(code: string, message: string): Promise<void>;
};
export async function orchestrateManagedDeployment(deps: ManagedOrchestratorDeps, input: { migrationDeclared: boolean; databaseRequired?: boolean }) {
  try {
    await deps.markProvisioning(); const validated = await deps.validate();
    const databaseRequired = input.databaseRequired ?? validated.capabilities.includes("database");
    if (input.migrationDeclared && !databaseRequired) throw new Error("MIGRATION_REQUIRES_DATABASE_CAPABILITY");
    const database = databaseRequired ? await deps.provisionDatabase() : undefined;
    if (input.migrationDeclared && database) await deps.runMigration(database.migrationUrl);
    const provider = await deps.deploy(database?.runtimeUrl);
    await deps.persistEvidence({ artifactDigest: validated.artifactDigest, ...provider });
    await deps.healthCheck(); await deps.activate(validated.capabilities);
    return { ok: true as const };
  } catch (error) {
    await deps.fail("MANAGED_DEPLOYMENT_FAILED", redactManagedFailure(error instanceof Error ? error.message : "Unknown failure"));
    return { ok: false as const };
  }
}

import assert from "node:assert/strict"; import test from "node:test";
import { orchestrateManagedDeployment, type ManagedOrchestratorDeps } from "../src/lib/universal-apps/managed-orchestrator.ts";
test("orchestrator health-gates activation and skips absent migration", async () => { const calls:string[]=[]; const d = {markProvisioning:async()=>{calls.push("mark");},validate:async()=>{calls.push("validate");return {artifactDigest:"sha",capabilities:["database"]};},provisionDatabase:async()=>{calls.push("db");return {migrationUrl:"postgresql://x",runtimeUrl:"postgresql://r"};},runMigration:async()=>{calls.push("migration");},deploy:async()=>{calls.push("deploy");return {providerProjectId:"p",providerDeploymentId:"d",publicRuntimeUrl:"https://x"};},persistEvidence:async()=>{calls.push("persist");},healthCheck:async()=>{calls.push("health");},activate:async()=>{calls.push("activate");},fail:async()=>{calls.push("fail");}} satisfies ManagedOrchestratorDeps; await orchestrateManagedDeployment(d,{migrationDeclared:false}); assert.deepEqual(calls,["mark","validate","db","deploy","persist","health","activate"]); });
test("orchestrator persists redacted failure and never activates", async()=>{const calls:string[]=[]; const d: ManagedOrchestratorDeps={markProvisioning:async()=>{},validate:async()=>{throw Error("DATABASE_URL=postgresql://secret")},provisionDatabase:async()=>({migrationUrl:"postgresql://migration",runtimeUrl:"postgresql://runtime"}),runMigration:async()=>{},deploy:async()=>({providerProjectId:"project",providerDeploymentId:"deployment",publicRuntimeUrl:"https://runtime.example"}),persistEvidence:async()=>{},healthCheck:async()=>{},activate:async()=>{calls.push("activate");},fail:async(_:string,m:string)=>{calls.push(m);}}; await orchestrateManagedDeployment(d,{migrationDeclared:true}); assert.equal(calls[0].includes("secret"),false); assert.equal(calls.includes("activate"),false);});
test("identity-only managed app never provisions a database or injects a runtime URL", async () => { const calls: string[] = []; const deps: ManagedOrchestratorDeps = { markProvisioning: async () => {}, validate: async () => ({ artifactDigest: "sha", capabilities: ["identity"] }), provisionDatabase: async () => { calls.push("db"); return { migrationUrl: "", runtimeUrl: "" }; }, runMigration: async () => { calls.push("migration"); }, deploy: async (url) => { calls.push(url ? "deploy-db" : "deploy-no-db"); return { providerProjectId: "p", providerDeploymentId: "d", publicRuntimeUrl: "https://x" }; }, persistEvidence: async () => {}, healthCheck: async () => {}, activate: async () => {}, fail: async () => { calls.push("fail"); } }; await orchestrateManagedDeployment(deps, { migrationDeclared: false, databaseRequired: false }); assert.deepEqual(calls, ["deploy-no-db"]); });

test("a failed health gate never reaches activation or predecessor credential retirement", async () => {
  const calls: string[] = [];
  const deps: ManagedOrchestratorDeps = {
    markProvisioning: async () => { calls.push("mark"); },
    validate: async () => ({ artifactDigest: "sha", capabilities: ["database"] }),
    provisionDatabase: async () => ({ migrationUrl: "postgresql://migration", runtimeUrl: "postgresql://runtime" }),
    runMigration: async () => {},
    deploy: async () => ({ providerProjectId: "p", providerDeploymentId: "d", publicRuntimeUrl: "https://runtime.example" }),
    persistEvidence: async () => { calls.push("persist"); },
    healthCheck: async () => { calls.push("health"); throw new Error("health unavailable"); },
    // Database role retirement occurs inside activation, so recording this is
    // the boundary assertion for a failed health check.
    activate: async () => { calls.push("activate-and-retire"); },
    fail: async () => { calls.push("fail"); },
  };
  const result = await orchestrateManagedDeployment(deps, { migrationDeclared: false });
  assert.deepEqual(result, { ok: false });
  assert.deepEqual(calls, ["mark", "persist", "health", "fail"]);
});

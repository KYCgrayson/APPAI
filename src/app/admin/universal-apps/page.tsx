export const dynamic = "force-dynamic";

import Link from "next/link";

import { ManagedReleaseDeploymentAction } from "@/components/admin/ManagedReleaseDeploymentAction";
import { db } from "@/lib/db";
import { universalAppManifestSchema } from "@/lib/universal-apps/manifest";
import {
  canStartManagedProductionDeployment,
  getReleaseReviewState,
  getSafeRepositoryUrl,
} from "@/lib/universal-apps/review";

const RELEASE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "RETIRED"] as const;

const statusClasses: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  RETIRED: "bg-gray-100 text-gray-700",
};

const reviewStateClasses = {
  neutral: "bg-gray-100 text-gray-700",
  warning: "bg-yellow-100 text-yellow-800",
  success: "bg-green-100 text-green-800",
  danger: "bg-red-100 text-red-800",
};

export default async function UniversalAppReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const selectedStatus = RELEASE_STATUSES.includes(status as (typeof RELEASE_STATUSES)[number]) ? status : undefined;
  const releases = await db.appRelease.findMany({
    where: selectedStatus ? { status: selectedStatus } : undefined,
    include: {
      app: {
        select: {
          appType: true,
          name: true,
          category: true,
          repoUrl: true,
          organization: { select: { name: true } },
        },
      },
      deployments: {
        select: { id: true, environment: true, status: true, healthCheckedAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      releasePackage: {
        select: { sourceDigest: true, actualSizeBytes: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Universal App releases</h1>
          <p className="mt-2 text-sm text-gray-500">Review submitted manifests and platform-controlled deployment progress.</p>
        </div>
        <span className="shrink-0 text-sm text-gray-500">{releases.length} releases</span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/admin/universal-apps" className={`rounded-full px-3 py-1 text-sm ${(selectedStatus === undefined) ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>All</Link>
        {RELEASE_STATUSES.map((releaseStatus) => (
          <Link key={releaseStatus} href={`/admin/universal-apps?status=${releaseStatus}`} className={`rounded-full px-3 py-1 text-sm ${selectedStatus === releaseStatus ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {releaseStatus}
          </Link>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        Deployment approval is platform-controlled. This queue intentionally does not accept database credentials, SQL, secrets, runtime URLs, or executable commands in the browser. A release without a platform-built artifact remains awaiting build / provisioning.
      </div>

      {releases.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm text-gray-500">No releases found.</div>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const parsedManifest = universalAppManifestSchema.safeParse(release.manifest);
            const capabilities = parsedManifest.success ? parsedManifest.data.capabilities : [];
            const isPackageSource = release.sourceType === "PACKAGE";
            const repositoryUrl = isPackageSource ? null : getSafeRepositoryUrl(release.sourceRepoUrl);
            const packageSize = release.releasePackage?.actualSizeBytes;
            const packageSource = release.releasePackage?.sourceDigest
              ? `${release.releasePackage.sourceDigest}${packageSize ? ` · ${packageSize.toLocaleString()} bytes` : ""}`
              : "Verification pending";
            const reviewState = getReleaseReviewState({
              releaseStatus: release.status,
              deploymentStatuses: release.deployments.map((deployment) => deployment.status),
            });
            const productionDeployment = release.deployments.find(
              (deployment) => deployment.environment === "PRODUCTION",
            );
            const canStartDeployment = canStartManagedProductionDeployment({
              releaseStatus: release.status,
              deployments: release.deployments,
            });
            return (
              <article key={release.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{release.app.name}</h2>
                      <span className="text-sm text-gray-500">{release.app.appType ?? "unassigned-app-id"} · v{release.version}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[release.status] ?? statusClasses.RETIRED}`}>{release.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${reviewStateClasses[reviewState.tone]}`}>{reviewState.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Owner: {release.app.organization.name} · Category: {release.app.category}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {canStartDeployment && <ManagedReleaseDeploymentAction releaseId={release.id} retry={productionDeployment?.status === "FAILED"} />}
                    <time className="text-xs text-gray-400" dateTime={release.createdAt.toISOString()}>{release.createdAt.toLocaleString()}</time>
                  </div>
                </div>

                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Capabilities</dt><dd className="mt-1 flex flex-wrap gap-1">{capabilities.length ? capabilities.map((capability) => <span key={capability} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{capability}</span>) : <span className="text-gray-500">Invalid manifest</span>}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Source type</dt><dd className="mt-1 text-xs font-medium text-gray-700">{isPackageSource ? "PACKAGE" : "REPOSITORY"}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Source revision</dt><dd className="mt-1 break-all font-mono text-xs text-gray-700">{isPackageSource ? "Not required" : (release.sourceRevision ?? "Not provided")}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Repository</dt><dd className="mt-1 break-all text-xs">{isPackageSource ? <span className="text-gray-500">Not required</span> : repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{repositoryUrl}</a> : <span className="text-gray-500">Invalid/unavailable</span>}</dd></div>
                  {isPackageSource && <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Verified package</dt><dd className="mt-1 break-all font-mono text-xs text-gray-700">{packageSource}</dd></div>}
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Artifact</dt><dd className="mt-1 break-all font-mono text-xs text-gray-700">{release.artifactDigest ?? "Awaiting platform build"}</dd></div>
                </dl>

                <div className="mt-4 border-t pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">Platform deployments</h3>
                  {release.deployments.length ? <ul className="mt-2 flex flex-wrap gap-2">{release.deployments.map((deployment) => <li key={deployment.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{deployment.environment}: <strong>{deployment.status}</strong>{deployment.healthCheckedAt ? ` · health checked ${deployment.healthCheckedAt.toLocaleString()}` : " · not health checked"}</li>)}</ul> : <p className="mt-2 text-sm text-gray-500">No platform deployment has been provisioned.</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

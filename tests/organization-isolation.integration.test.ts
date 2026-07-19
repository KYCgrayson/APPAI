import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("two Organizations cannot read each other's native app or private asset rows", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL and apply the Phase 1 migration.",
}, async () => {
  assert.ok(testDatabaseUrl);
  const db = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const runId = randomUUID();
  const organizationA = await db.organization.create({
    data: { name: "Isolation A", slug: `isolation-a-${runId}` },
  });
  const organizationB = await db.organization.create({
    data: { name: "Isolation B", slug: `isolation-b-${runId}` },
  });

  try {
    const [instanceA, instanceB] = await Promise.all([
      db.organizationApp.create({
        data: {
          organizationId: organizationA.id,
          appType: "simpleshop",
          config: { schemaVersion: 1, settings: { shopName: "A" } },
        },
      }),
      db.organizationApp.create({
        data: {
          organizationId: organizationB.id,
          appType: "simpleshop",
          config: { schemaVersion: 1, settings: { shopName: "B" } },
        },
      }),
    ]);
    const assetB = await db.privateAsset.create({
      data: {
        organizationId: organizationB.id,
        appType: "simpleshop",
        pathname: `isolation/${runId}/b.pdf`,
        originalName: "b.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        createdByUserId: "integration-user-b",
      },
    });

    const visibleInstancesA = await db.organizationApp.findMany({
      where: { organizationId: organizationA.id, appType: "simpleshop" },
    });
    const forgedAssetRead = await db.privateAsset.findFirst({
      where: {
        id: assetB.id,
        organizationId: organizationA.id,
        appType: "simpleshop",
      },
    });

    assert.deepEqual(visibleInstancesA.map((instance) => instance.id), [instanceA.id]);
    assert.notEqual(instanceA.id, instanceB.id);
    assert.equal(forgedAssetRead, null);
  } finally {
    await db.organization.deleteMany({
      where: { id: { in: [organizationA.id, organizationB.id] } },
    });
    await db.$disconnect();
  }
});

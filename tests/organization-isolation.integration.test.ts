import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("two Organizations cannot read each other's native app or private asset rows", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL and apply the Phase 2 migration.",
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

test("Simpleshop master-data relations and reads stay inside one Organization", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL and apply the Phase 2 migration.",
}, async () => {
  assert.ok(testDatabaseUrl);
  const db = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const runId = randomUUID();
  const organizationA = await db.organization.create({
    data: { name: "Master Data A", slug: `master-data-a-${runId}` },
  });
  const organizationB = await db.organization.create({
    data: { name: "Master Data B", slug: `master-data-b-${runId}` },
  });

  try {
    await Promise.all([
      db.organizationApp.create({ data: { organizationId: organizationA.id, appType: "simpleshop" } }),
      db.organizationApp.create({ data: { organizationId: organizationB.id, appType: "simpleshop" } }),
    ]);
    const [customerA, customerB] = await Promise.all([
      db.customer.create({ data: { organizationId: organizationA.id, customerCode: 1, name: "Customer A" } }),
      db.customer.create({ data: { organizationId: organizationB.id, customerCode: 1, name: "Customer B" } }),
    ]);

    await assert.rejects(
      db.jobSite.create({
        data: { organizationId: organizationA.id, customerId: customerB.id, name: "Forged Site" },
      }),
    );

    const siteA = await db.jobSite.create({
      data: { organizationId: organizationA.id, customerId: customerA.id, name: "Site A" },
    });
    const itemB = await db.item.create({
      data: {
        organizationId: organizationB.id,
        itemCode: "B-001",
        canonicalName: "Item B",
        defaultUnit: "EA",
        aliases: { create: { alias: "Secret B", normalizedAlias: "secret b" } },
      },
    });

    const forgedSiteRead = await db.jobSite.findFirst({
      where: { id: siteA.id, organizationId: organizationB.id },
    });
    const forgedItemRead = await db.item.findFirst({
      where: {
        id: itemB.id,
        organizationId: organizationA.id,
        aliases: { some: { normalizedAlias: { contains: "secret" } } },
      },
    });
    assert.equal(forgedSiteRead, null);
    assert.equal(forgedItemRead, null);
  } finally {
    await db.organization.deleteMany({
      where: { id: { in: [organizationA.id, organizationB.id] } },
    });
    await db.$disconnect();
  }
});

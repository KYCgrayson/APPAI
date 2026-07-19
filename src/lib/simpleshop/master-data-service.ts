import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NativeAppError } from "@/lib/native-apps/errors";
import { getSimpleshopSettings, requireActiveOrganizationApp } from "@/lib/native-apps/service";
import {
  customerCreateSchema,
  itemCreateSchema,
  normalizeMasterDataText,
  type CustomerCreateInput,
  type CustomerPatchInput,
  type ItemCreateInput,
  type ItemPatchInput,
  type JobSiteCreateInput,
  type JobSitePatchInput,
} from "@/lib/simpleshop/master-data-schema";

type ListOptions = { q?: string; limit?: number };

function nullable(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function currentMonth(timeZone = "Asia/Taipei", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Unable to resolve the current month.");
  return `${year}-${month}`;
}

async function nextSequence(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  key: string,
) {
  const sequence = await transaction.simpleshopSequence.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  });
  return sequence.lastValue;
}

function translateDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new NativeAppError("CONFLICT", 409, "已有相同代碼或別名的資料。");
    }
    if (error.code === "P2003" || error.code === "P2025") {
      throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到目前店家的相關資料。");
    }
  }
  throw error;
}

async function requireSimpleshop(organizationId: string) {
  await requireActiveOrganizationApp(organizationId, "simpleshop");
}

export async function listCustomers(organizationId: string, options: ListOptions = {}) {
  await requireSimpleshop(organizationId);
  const q = options.q?.trim() ?? "";
  return db.customer.findMany({
    where: {
      organizationId,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { shortName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          ...(/^\d+$/.test(q) ? [{ customerCode: Number(q) }] : []),
        ],
      } : {}),
    },
    orderBy: [{ status: "asc" }, { customerCode: "desc" }],
    take: options.limit ?? 50,
    include: { _count: { select: { jobSites: true, contacts: true } } },
  });
}

export async function getCustomer(organizationId: string, id: string) {
  await requireSimpleshop(organizationId);
  const customer = await db.customer.findUnique({
    where: { organizationId_id: { organizationId, id } },
    include: { jobSites: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到客戶。");
  return customer;
}

export async function createCustomer(organizationId: string, input: CustomerCreateInput) {
  await requireSimpleshop(organizationId);
  const data = customerCreateSchema.parse(input);
  try {
    return await db.$transaction(async (transaction) => {
      const customerCode = await nextSequence(transaction, organizationId, "customer");
      return transaction.customer.create({
        data: {
          organizationId,
          customerCode,
          name: data.name,
          shortName: nullable(data.shortName),
          phone: nullable(data.phone),
          address: nullable(data.address),
          paymentTermsDays: data.paymentTermsDays ?? null,
          status: data.status,
          notes: nullable(data.notes),
        },
      });
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

export async function updateCustomer(
  organizationId: string,
  id: string,
  patch: CustomerPatchInput,
) {
  await requireSimpleshop(organizationId);
  try {
    return await db.customer.update({
      where: { organizationId_id: { organizationId, id } },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.shortName !== undefined ? { shortName: nullable(patch.shortName) } : {}),
        ...(patch.phone !== undefined ? { phone: nullable(patch.phone) } : {}),
        ...(patch.address !== undefined ? { address: nullable(patch.address) } : {}),
        ...(patch.paymentTermsDays !== undefined ? { paymentTermsDays: patch.paymentTermsDays } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.notes !== undefined ? { notes: nullable(patch.notes) } : {}),
      },
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

export async function listJobSites(
  organizationId: string,
  options: ListOptions & { customerId?: string; month?: string } = {},
) {
  const { settings } = await getSimpleshopSettings(organizationId);
  const q = options.q?.trim() ?? "";
  const month = options.month ?? currentMonth(settings.timezone);
  return db.jobSite.findMany({
    where: {
      organizationId,
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { keyword: { contains: q, mode: "insensitive" as const } },
          { address: { contains: q, mode: "insensitive" as const } },
          { aliases: { some: { normalizedAlias: { contains: normalizeMasterDataText(q) } } } },
        ],
      } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: options.limit ?? 50,
    include: {
      customer: { select: { id: true, customerCode: true, name: true } },
      aliases: { select: { alias: true }, orderBy: { alias: "asc" } },
      monthCodes: { where: { month }, select: { month: true, monthlyCode: true } },
    },
  });
}

export async function getJobSite(organizationId: string, id: string) {
  await requireSimpleshop(organizationId);
  const site = await db.jobSite.findUnique({
    where: { organizationId_id: { organizationId, id } },
    include: { customer: true, aliases: true, monthCodes: { orderBy: { month: "desc" } } },
  });
  if (!site) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到工地。");
  return site;
}

function uniqueAliases(aliases: string[]) {
  const values = new Map<string, string>();
  for (const alias of aliases) values.set(normalizeMasterDataText(alias), alias.trim());
  return [...values.entries()].map(([normalizedAlias, alias]) => ({ normalizedAlias, alias }));
}

export async function createJobSite(organizationId: string, input: JobSiteCreateInput) {
  const { settings } = await getSimpleshopSettings(organizationId);
  const month = currentMonth(settings.timezone);
  try {
    return await db.$transaction(async (transaction) => {
      const customer = await transaction.customer.findUnique({
        where: { organizationId_id: { organizationId, id: input.customerId } },
        select: { id: true, status: true },
      });
      if (!customer) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到客戶。");
      if (customer.status !== "ACTIVE") {
        throw new NativeAppError("CONFLICT", 409, "停用的客戶不能新增工地。");
      }
      const monthlyCode = await nextSequence(transaction, organizationId, `job-site:${month}`);
      return transaction.jobSite.create({
        data: {
          organizationId,
          customerId: input.customerId,
          name: input.name,
          keyword: nullable(input.keyword),
          address: nullable(input.address),
          contactName: nullable(input.contactName),
          contactPhone: nullable(input.contactPhone),
          status: input.status,
          notes: nullable(input.notes),
          aliases: {
            create: uniqueAliases(input.aliases),
          },
          monthCodes: { create: { month, monthlyCode } },
        },
        include: { aliases: true, monthCodes: true },
      });
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

export async function updateJobSite(
  organizationId: string,
  id: string,
  patch: JobSitePatchInput,
) {
  await requireSimpleshop(organizationId);
  try {
    return await db.$transaction(async (transaction) => {
      const existing = await transaction.jobSite.findUnique({
        where: { organizationId_id: { organizationId, id } },
        select: { id: true },
      });
      if (!existing) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到工地。");
      return transaction.jobSite.update({
        where: { organizationId_id: { organizationId, id } },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.keyword !== undefined ? { keyword: nullable(patch.keyword) } : {}),
          ...(patch.address !== undefined ? { address: nullable(patch.address) } : {}),
          ...(patch.contactName !== undefined ? { contactName: nullable(patch.contactName) } : {}),
          ...(patch.contactPhone !== undefined ? { contactPhone: nullable(patch.contactPhone) } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.notes !== undefined ? { notes: nullable(patch.notes) } : {}),
          ...(patch.aliases !== undefined ? {
            aliases: {
              deleteMany: {},
              create: uniqueAliases(patch.aliases),
            },
          } : {}),
        },
        include: { aliases: true, monthCodes: true },
      });
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

function itemUnitRows(input: ItemCreateInput) {
  const units = new Map(input.units.map((unit) => [unit.unitCode, unit]));
  if (!units.has(input.defaultUnit)) {
    units.set(input.defaultUnit, { unitCode: input.defaultUnit, label: input.defaultUnit, conversionRate: 1 });
  }
  return [...units.values()].map((unit) => ({
    unitCode: unit.unitCode,
    label: unit.label,
    conversionRate: unit.conversionRate ?? (unit.unitCode === input.defaultUnit ? 1 : null),
    isDefault: unit.unitCode === input.defaultUnit,
  }));
}

async function categoryIdFor(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  categoryName: string | null | undefined,
  dimensionMode: ItemCreateInput["dimensionMode"],
) {
  const name = nullable(categoryName);
  if (!name) return null;
  const category = await transaction.itemCategory.upsert({
    where: { organizationId_normalizedName: { organizationId, normalizedName: normalizeMasterDataText(name) } },
    create: { organizationId, name, normalizedName: normalizeMasterDataText(name), dimensionMode },
    update: { name, status: "ACTIVE" },
    select: { id: true },
  });
  return category.id;
}

function itemData(input: ItemCreateInput, categoryId: string | null) {
  return {
    categoryId,
    itemCode: input.itemCode,
    canonicalName: input.canonicalName,
    material: nullable(input.material),
    grade: nullable(input.grade),
    dimensionMode: input.dimensionMode,
    length: input.length ?? null,
    width: input.width ?? null,
    thickness: input.thickness ?? null,
    dimensionUnit: nullable(input.dimensionUnit),
    defaultUnit: input.defaultUnit,
    calculationMethod: input.calculationMethod,
    status: input.status,
    notes: nullable(input.notes),
  };
}

export async function listItems(organizationId: string, options: ListOptions = {}) {
  await requireSimpleshop(organizationId);
  const q = options.q?.trim() ?? "";
  return db.item.findMany({
    where: {
      organizationId,
      ...(q ? {
        OR: [
          { itemCode: { contains: q, mode: "insensitive" as const } },
          { canonicalName: { contains: q, mode: "insensitive" as const } },
          { material: { contains: q, mode: "insensitive" as const } },
          { aliases: { some: { normalizedAlias: { contains: normalizeMasterDataText(q) } } } },
        ],
      } : {}),
    },
    orderBy: [{ status: "asc" }, { itemCode: "asc" }],
    take: options.limit ?? 50,
    include: { category: true, aliases: true, units: { orderBy: [{ isDefault: "desc" }, { unitCode: "asc" }] } },
  });
}

export async function getItem(organizationId: string, id: string) {
  await requireSimpleshop(organizationId);
  const item = await db.item.findUnique({
    where: { organizationId_id: { organizationId, id } },
    include: { category: true, aliases: true, units: true, priceRecords: { orderBy: { effectiveFrom: "desc" } } },
  });
  if (!item) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到品項。");
  return item;
}

export async function createItem(organizationId: string, input: ItemCreateInput) {
  await requireSimpleshop(organizationId);
  try {
    return await db.$transaction(async (transaction) => {
      const categoryId = await categoryIdFor(transaction, organizationId, input.categoryName, input.dimensionMode);
      return transaction.item.create({
        data: {
          organizationId,
          ...itemData(input, categoryId),
          aliases: { create: uniqueAliases(input.aliases) },
          units: { create: itemUnitRows(input) },
        },
        include: { category: true, aliases: true, units: true },
      });
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

export async function updateItem(
  organizationId: string,
  id: string,
  patch: ItemPatchInput,
) {
  await requireSimpleshop(organizationId);
  try {
    return await db.$transaction(async (transaction) => {
      const existing = await transaction.item.findUnique({
        where: { organizationId_id: { organizationId, id } },
        include: { category: true, aliases: true, units: true },
      });
      if (!existing) throw new NativeAppError("RESOURCE_NOT_FOUND", 404, "找不到品項。");

      const merged = itemCreateSchema.parse({
        categoryName: patch.categoryName !== undefined ? patch.categoryName : existing.category?.name,
        itemCode: patch.itemCode ?? existing.itemCode,
        canonicalName: patch.canonicalName ?? existing.canonicalName,
        material: patch.material !== undefined ? patch.material : existing.material,
        grade: patch.grade !== undefined ? patch.grade : existing.grade,
        dimensionMode: patch.dimensionMode ?? existing.dimensionMode,
        length: patch.length !== undefined ? patch.length : existing.length ? Number(existing.length) : null,
        width: patch.width !== undefined ? patch.width : existing.width ? Number(existing.width) : null,
        thickness: patch.thickness !== undefined ? patch.thickness : existing.thickness ? Number(existing.thickness) : null,
        dimensionUnit: patch.dimensionUnit !== undefined ? patch.dimensionUnit : existing.dimensionUnit,
        defaultUnit: patch.defaultUnit ?? existing.defaultUnit,
        calculationMethod: patch.calculationMethod ?? existing.calculationMethod,
        status: patch.status ?? existing.status,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        aliases: patch.aliases ?? existing.aliases.map((alias) => alias.alias),
        units: patch.units ?? existing.units.map((unit) => ({
          unitCode: unit.unitCode,
          label: unit.label,
          conversionRate: unit.conversionRate ? Number(unit.conversionRate) : null,
        })),
      });
      const categoryId = await categoryIdFor(transaction, organizationId, merged.categoryName, merged.dimensionMode);
      return transaction.item.update({
        where: { organizationId_id: { organizationId, id } },
        data: {
          ...itemData(merged, categoryId),
          aliases: {
            deleteMany: {},
            create: uniqueAliases(merged.aliases),
          },
          units: {
            deleteMany: {},
            create: itemUnitRows(merged),
          },
        },
        include: { category: true, aliases: true, units: true },
      });
    });
  } catch (error) {
    translateDatabaseError(error);
  }
}

export const simpleshopMasterDataInternals = { currentMonth, uniqueAliases, itemUnitRows };

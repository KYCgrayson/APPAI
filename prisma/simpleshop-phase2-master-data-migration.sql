-- Simpleshop Phase 2 master data. Apply once to the AppAI database.
-- The transaction prevents a partially-created schema if any invariant fails.
BEGIN;

-- CreateTable
CREATE TABLE "SimpleshopSequence" (
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimpleshopSequence_pkey" PRIMARY KEY ("organizationId","key")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerCode" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTermsDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSiteAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobSiteId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSiteAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSiteMonthCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobSiteId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "monthlyCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSiteMonthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "dimensionMode" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "itemCode" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "material" TEXT,
    "grade" TEXT,
    "dimensionMode" TEXT NOT NULL DEFAULT 'NONE',
    "length" DECIMAL(14,4),
    "width" DECIMAL(14,4),
    "thickness" DECIMAL(14,4),
    "dimensionUnit" TEXT,
    "defaultUnit" TEXT NOT NULL,
    "calculationMethod" TEXT NOT NULL DEFAULT 'QUANTITY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "conversionRate" DECIMAL(18,6),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "customerId" TEXT,
    "jobSiteId" TEXT,
    "unitCode" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobSiteId" TEXT,
    "contactType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "notes" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- Domain invariants that Prisma models as strings.
ALTER TABLE "SimpleshopSequence" ADD CONSTRAINT "SimpleshopSequence_lastValue_check" CHECK ("lastValue" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerCode_check" CHECK ("customerCode" > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_paymentTermsDays_check" CHECK ("paymentTermsDays" IS NULL OR "paymentTermsDays" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "JobSite" ADD CONSTRAINT "JobSite_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED', 'INACTIVE'));
ALTER TABLE "JobSiteMonthCode" ADD CONSTRAINT "JobSiteMonthCode_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "JobSiteMonthCode" ADD CONSTRAINT "JobSiteMonthCode_monthlyCode_check" CHECK ("monthlyCode" > 0);
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_dimensionMode_check" CHECK ("dimensionMode" IN ('NONE', 'OPTIONAL', 'REQUIRED'));
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "Item" ADD CONSTRAINT "Item_dimensionMode_check" CHECK ("dimensionMode" IN ('NONE', 'OPTIONAL', 'REQUIRED'));
ALTER TABLE "Item" ADD CONSTRAINT "Item_calculationMethod_check" CHECK ("calculationMethod" IN ('QUANTITY', 'CONVERSION', 'BOARD_MEASURE'));
ALTER TABLE "Item" ADD CONSTRAINT "Item_status_check" CHECK ("status" IN ('ACTIVE', 'PENDING', 'INACTIVE'));
ALTER TABLE "Item" ADD CONSTRAINT "Item_dimensions_check" CHECK (
    ("dimensionMode" = 'NONE' AND "length" IS NULL AND "width" IS NULL AND "thickness" IS NULL AND "dimensionUnit" IS NULL)
    OR ("dimensionMode" = 'OPTIONAL' AND ("length" IS NULL OR "length" > 0) AND ("width" IS NULL OR "width" > 0) AND ("thickness" IS NULL OR "thickness" > 0))
    OR ("dimensionMode" = 'REQUIRED' AND "length" > 0 AND "width" > 0 AND "thickness" > 0 AND "dimensionUnit" IS NOT NULL)
);
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_conversionRate_check" CHECK ("conversionRate" IS NULL OR "conversionRate" > 0);
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_priceType_check" CHECK ("priceType" IN ('PURCHASE', 'RETAIL', 'WHOLESALE', 'CUSTOMER', 'JOB_SITE'));
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_scope_check" CHECK (
    ("priceType" = 'CUSTOMER' AND "customerId" IS NOT NULL AND "jobSiteId" IS NULL)
    OR ("priceType" = 'JOB_SITE' AND "customerId" IS NOT NULL AND "jobSiteId" IS NOT NULL)
    OR ("priceType" IN ('PURCHASE', 'RETAIL', 'WHOLESALE') AND "customerId" IS NULL AND "jobSiteId" IS NULL)
);
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_effectiveDates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_contactType_check" CHECK ("contactType" IN ('PHONE', 'MESSAGE', 'VISIT', 'QUOTE', 'NOTE'));

-- CreateIndex
CREATE INDEX "Customer_organizationId_status_name_idx" ON "Customer"("organizationId", "status", "name");

-- CreateIndex
CREATE INDEX "Customer_organizationId_phone_idx" ON "Customer"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_customerCode_key" ON "Customer"("organizationId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_id_key" ON "Customer"("organizationId", "id");

-- CreateIndex
CREATE INDEX "JobSite_organizationId_customerId_status_idx" ON "JobSite"("organizationId", "customerId", "status");

-- CreateIndex
CREATE INDEX "JobSite_organizationId_name_idx" ON "JobSite"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JobSite_organizationId_id_key" ON "JobSite"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JobSite_organizationId_customerId_id_key" ON "JobSite"("organizationId", "customerId", "id");

-- CreateIndex
CREATE INDEX "JobSiteAlias_organizationId_jobSiteId_idx" ON "JobSiteAlias"("organizationId", "jobSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "JobSiteAlias_organizationId_customerId_normalizedAlias_key" ON "JobSiteAlias"("organizationId", "customerId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "JobSiteMonthCode_organizationId_jobSiteId_month_idx" ON "JobSiteMonthCode"("organizationId", "jobSiteId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "JobSiteMonthCode_organizationId_month_monthlyCode_key" ON "JobSiteMonthCode"("organizationId", "month", "monthlyCode");

-- CreateIndex
CREATE UNIQUE INDEX "JobSiteMonthCode_organizationId_month_jobSiteId_key" ON "JobSiteMonthCode"("organizationId", "month", "jobSiteId");

-- CreateIndex
CREATE INDEX "ItemCategory_organizationId_status_name_idx" ON "ItemCategory"("organizationId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_organizationId_normalizedName_key" ON "ItemCategory"("organizationId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_organizationId_id_key" ON "ItemCategory"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Item_organizationId_status_canonicalName_idx" ON "Item"("organizationId", "status", "canonicalName");

-- CreateIndex
CREATE INDEX "Item_organizationId_categoryId_status_idx" ON "Item"("organizationId", "categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Item_organizationId_itemCode_key" ON "Item"("organizationId", "itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "Item_organizationId_id_key" ON "Item"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ItemAlias_organizationId_itemId_idx" ON "ItemAlias"("organizationId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAlias_organizationId_normalizedAlias_key" ON "ItemAlias"("organizationId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "ItemUnit_organizationId_itemId_status_idx" ON "ItemUnit"("organizationId", "itemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnit_organizationId_itemId_unitCode_key" ON "ItemUnit"("organizationId", "itemId", "unitCode");

-- CreateIndex
CREATE INDEX "PriceRecord_organizationId_itemId_priceType_effectiveFrom_idx" ON "PriceRecord"("organizationId", "itemId", "priceType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PriceRecord_organizationId_customerId_status_idx" ON "PriceRecord"("organizationId", "customerId", "status");

-- CreateIndex
CREATE INDEX "PriceRecord_organizationId_jobSiteId_status_idx" ON "PriceRecord"("organizationId", "jobSiteId", "status");

-- CreateIndex
CREATE INDEX "CustomerContact_organizationId_customerId_occurredAt_idx" ON "CustomerContact"("organizationId", "customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerContact_organizationId_jobSiteId_occurredAt_idx" ON "CustomerContact"("organizationId", "jobSiteId", "occurredAt");

-- AddForeignKey
ALTER TABLE "SimpleshopSequence" ADD CONSTRAINT "SimpleshopSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSite" ADD CONSTRAINT "JobSite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSite" ADD CONSTRAINT "JobSite_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSiteAlias" ADD CONSTRAINT "JobSiteAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSiteAlias" ADD CONSTRAINT "JobSiteAlias_organizationId_customerId_jobSiteId_fkey" FOREIGN KEY ("organizationId", "customerId", "jobSiteId") REFERENCES "JobSite"("organizationId", "customerId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSiteMonthCode" ADD CONSTRAINT "JobSiteMonthCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSiteMonthCode" ADD CONSTRAINT "JobSiteMonthCode_organizationId_jobSiteId_fkey" FOREIGN KEY ("organizationId", "jobSiteId") REFERENCES "JobSite"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "ItemCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAlias" ADD CONSTRAINT "ItemAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAlias" ADD CONSTRAINT "ItemAlias_organizationId_itemId_fkey" FOREIGN KEY ("organizationId", "itemId") REFERENCES "Item"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_organizationId_itemId_fkey" FOREIGN KEY ("organizationId", "itemId") REFERENCES "Item"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_organizationId_itemId_fkey" FOREIGN KEY ("organizationId", "itemId") REFERENCES "Item"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_organizationId_jobSiteId_fkey" FOREIGN KEY ("organizationId", "jobSiteId") REFERENCES "JobSite"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_organizationId_jobSiteId_fkey" FOREIGN KEY ("organizationId", "jobSiteId") REFERENCES "JobSite"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

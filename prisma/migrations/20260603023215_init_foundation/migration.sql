-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'kitchen', 'rider', 'admin');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('scheduled', 'payment_pending', 'received', 'preparing', 'ready', 'batched', 'assigned_to_rider', 'on_the_way', 'delivered', 'delivery_attempted', 'unclaimed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initiated', 'pending', 'successful', 'failed', 'abandoned', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('wallet', 'card', 'split');

-- CreateEnum
CREATE TYPE "HpTransactionType" AS ENUM ('earn', 'spend', 'expire', 'admin_grant');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "DeliveryWindowStatus" AS ENUM ('draft', 'open', 'closed', 'batching', 'batched', 'in_delivery', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryBatchStatus" AS ENUM ('created', 'assigned', 'in_delivery', 'completed', 'partially_failed');

-- CreateEnum
CREATE TYPE "MarketplaceCodeStatus" AS ENUM ('available', 'assigned', 'redeemed', 'void');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "dob" TIMESTAMP(3),
    "faculty" TEXT,
    "photoUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "googleId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "hpEarnValue" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "status" "OrderStatus" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "deliveryWindowId" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentRef" TEXT,
    "hpEarned" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "secureTrackingToken" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKobo" INTEGER NOT NULL,
    "subtotalKobo" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryWindow" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "cutoffAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "status" "DeliveryWindowStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryBatch" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "riderId" TEXT,
    "zone" TEXT NOT NULL,
    "status" "DeliveryBatchStatus" NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchOrder" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "BatchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "HpTransactionType" NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "reference" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_name_key" ON "MenuCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_slug_key" ON "MenuCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_sku_key" ON "MenuItem"("sku");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_isAvailable_idx" ON "MenuItem"("categoryId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_secureTrackingToken_key" ON "Order"("secureTrackingToken");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_deliveryWindowId_status_idx" ON "Order"("deliveryWindowId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryWindow_status_opensAt_closesAt_idx" ON "DeliveryWindow"("status", "opensAt", "closesAt");

-- CreateIndex
CREATE INDEX "DeliveryBatch_windowId_riderId_status_idx" ON "DeliveryBatch"("windowId", "riderId", "status");

-- CreateIndex
CREATE INDEX "BatchOrder_orderId_idx" ON "BatchOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchOrder_batchId_orderId_key" ON "BatchOrder"("batchId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "HpTransaction_idempotencyKey_key" ON "HpTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HpTransaction_userId_createdAt_idx" ON "HpTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HpTransaction_referenceType_referenceId_idx" ON "HpTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_resourceType_resourceId_idx" ON "AdminAuditLog"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryWindowId_fkey" FOREIGN KEY ("deliveryWindowId") REFERENCES "DeliveryWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryWindow" ADD CONSTRAINT "DeliveryWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "DeliveryWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOrder" ADD CONSTRAINT "BatchOrder_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DeliveryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOrder" ADD CONSTRAINT "BatchOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HpTransaction" ADD CONSTRAINT "HpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OperatingHour" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAtMinutes" INTEGER NOT NULL,
    "closesAtMinutes" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "overrideMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingHour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperatingHour_dayOfWeek_key" ON "OperatingHour"("dayOfWeek");

ALTER TABLE "OperatingHour"
ADD CONSTRAINT "OperatingHour_dayOfWeek_check"
CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6);

ALTER TABLE "OperatingHour"
ADD CONSTRAINT "OperatingHour_opensAtMinutes_check"
CHECK ("opensAtMinutes" >= 0 AND "opensAtMinutes" <= 1439);

ALTER TABLE "OperatingHour"
ADD CONSTRAINT "OperatingHour_closesAtMinutes_check"
CHECK ("closesAtMinutes" >= 0 AND "closesAtMinutes" <= 1439);

ALTER TABLE "OperatingHour"
ADD CONSTRAINT "OperatingHour_time_range_check"
CHECK ("isClosed" = true OR "closesAtMinutes" > "opensAtMinutes");

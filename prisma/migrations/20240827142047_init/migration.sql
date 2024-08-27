-- CreateEnum
CREATE TYPE "Type" AS ENUM ('WATER', 'GAS');

-- CreateTable
CREATE TABLE "Customer" (
    "customer_code" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customer_code")
);

-- CreateTable
CREATE TABLE "Measure" (
    "uuid" VARCHAR(36) NOT NULL,
    "customer_code" TEXT NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "type" "Type" NOT NULL,
    "has_confirmed" BOOLEAN NOT NULL,
    "image_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measure_pkey" PRIMARY KEY ("uuid")
);

-- AddForeignKey
ALTER TABLE "Measure" ADD CONSTRAINT "Measure_customer_code_fkey" FOREIGN KEY ("customer_code") REFERENCES "Customer"("customer_code") ON DELETE RESTRICT ON UPDATE CASCADE;

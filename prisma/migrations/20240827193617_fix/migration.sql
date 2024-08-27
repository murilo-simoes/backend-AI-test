-- AlterTable
ALTER TABLE "Measure" ALTER COLUMN "image_url" SET DATA TYPE VARCHAR;

-- CreateTable
CREATE TABLE "Customer" (
    "customer_code" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customer_code")
);

-- AddForeignKey
ALTER TABLE "Measure" ADD CONSTRAINT "Measure_customer_code_fkey" FOREIGN KEY ("customer_code") REFERENCES "Customer"("customer_code") ON DELETE RESTRICT ON UPDATE CASCADE;

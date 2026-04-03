-- CreateTable
CREATE TABLE "BookingMessageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookingId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingMessageLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BookingMessageLog_bookingId_idx" ON "BookingMessageLog"("bookingId");

-- CreateIndex
CREATE INDEX "BookingMessageLog_kind_idx" ON "BookingMessageLog"("kind");

-- CreateIndex
CREATE INDEX "BookingMessageLog_template_idx" ON "BookingMessageLog"("template");

-- CreateIndex
CREATE INDEX "BookingMessageLog_sentAt_idx" ON "BookingMessageLog"("sentAt");

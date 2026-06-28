CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "link"        TEXT,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "channel"     TEXT NOT NULL DEFAULT 'IN_APP',
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "readAt"      TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_recipientId_idx"
  ON "Notification"("recipientId");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_idx"
  ON "Notification"("tenantId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx"
  ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
  ON "Notification"("createdAt");

CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key"         TEXT NOT NULL,
  "value"       TEXT,
  "encrypted"   BOOLEAN NOT NULL DEFAULT false,
  "keyVersion"  TEXT DEFAULT 'v1',
  "category"    TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "PlatformSetting_category_idx"
  ON "PlatformSetting"("category");

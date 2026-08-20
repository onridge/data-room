-- Split File into a logical document (name in a folder) plus FileVersion
-- (the bytes). Written by hand rather than generated: the generated version
-- drops storageKey/sizeBytes/mimeType/status outright, which would destroy
-- every existing upload, and adds a NOT NULL createdById with no default,
-- which cannot succeed on a non-empty table.
--
-- Order matters: create the new table, backfill from the old columns, and
-- only then drop them.

-- 1. The new table, without its foreign keys yet.
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- 2. New columns on files. createdById is nullable for now so the backfill
--    below can populate it before the NOT NULL constraint goes on.
ALTER TABLE "files" ADD COLUMN "createdById" TEXT;
ALTER TABLE "files" ADD COLUMN "currentVersionId" TEXT;

-- 3. Every existing file becomes version 1 of itself, keeping its original
--    storage key, size, uploader and status. gen_random_uuid() is available
--    without an extension on Postgres 13+.
INSERT INTO "file_versions" (
    "id", "fileId", "versionNumber", "sizeBytes", "mimeType",
    "storageKey", "uploadedById", "status", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    1,
    "sizeBytes",
    "mimeType",
    "storageKey",
    "uploadedById",
    "status",
    "createdAt"
FROM "files";

-- 4. Carry the uploader over as the document's creator.
UPDATE "files" SET "createdById" = "uploadedById";

-- 5. Point each file at its version — but only where the upload actually
--    completed. A file still PENDING keeps a null currentVersionId, which is
--    exactly what keeps it out of listings.
UPDATE "files" f
SET "currentVersionId" = v."id"
FROM "file_versions" v
WHERE v."fileId" = f."id"
  AND v."versionNumber" = 1
  AND v."status" = 'READY';

-- 6. Now that every row has a creator, enforce it.
ALTER TABLE "files" ALTER COLUMN "createdById" SET NOT NULL;

-- 7. The old per-file content columns have been copied out; drop them.
ALTER TABLE "files" DROP CONSTRAINT "files_uploadedById_fkey";
DROP INDEX "files_storageKey_key";
ALTER TABLE "files"
    DROP COLUMN "mimeType",
    DROP COLUMN "sizeBytes",
    DROP COLUMN "status",
    DROP COLUMN "storageKey",
    DROP COLUMN "uploadedById";

-- 8. Indexes and foreign keys.
CREATE UNIQUE INDEX "file_versions_storageKey_key" ON "file_versions"("storageKey");
CREATE INDEX "file_versions_fileId_idx" ON "file_versions"("fileId");
CREATE UNIQUE INDEX "file_versions_fileId_versionNumber_key" ON "file_versions"("fileId", "versionNumber");
CREATE UNIQUE INDEX "files_currentVersionId_key" ON "files"("currentVersionId");

ALTER TABLE "files" ADD CONSTRAINT "files_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "file_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

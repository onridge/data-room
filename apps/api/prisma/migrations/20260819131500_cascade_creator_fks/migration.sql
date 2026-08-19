-- createdById/uploadedById always equal the owning data room's owner today
-- (only owners create folders/files/shares). Leaving these RESTRICT means
-- Postgres can fail a User delete on this constraint even though the same
-- statement's cascade through DataRoom would remove the row anyway —
-- constraint-check order across independent FK paths isn't guaranteed.
ALTER TABLE "folders" DROP CONSTRAINT "folders_createdById_fkey";
ALTER TABLE "folders" ADD CONSTRAINT "folders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "files" DROP CONSTRAINT "files_uploadedById_fkey";
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shares" DROP CONSTRAINT "shares_createdById_fkey";
ALTER TABLE "shares" ADD CONSTRAINT "shares_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

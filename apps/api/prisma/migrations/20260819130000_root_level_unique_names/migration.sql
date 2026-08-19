-- Postgres treats NULL as distinct from NULL in a regular unique index, so
-- the existing @@unique([dataRoomId, parentId, name]) / ([dataRoomId,
-- folderId, name]) constraints only catch name conflicts among non-root
-- siblings — two root-level folders/files with the same name both have
-- parentId/folderId = NULL and were slipping through. These partial
-- indexes cover the root case specifically.
CREATE UNIQUE INDEX "folders_root_name_key" ON "folders" ("dataRoomId", "name") WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "files_root_name_key" ON "files" ("dataRoomId", "name") WHERE "folderId" IS NULL;

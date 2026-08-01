-- An asset no longer has to live in a project. A character created straight in
-- the marketplace has no source project, but it is still registered and
-- tradable, so the container cannot be where its permissions come from.
-- Existing rows all keep their project; nothing is detached by this migration.
ALTER TABLE "Asset" ALTER COLUMN "projectId" DROP NOT NULL;

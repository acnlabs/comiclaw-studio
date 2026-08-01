-- A column can name an editor agent (comiclaw for 《AI 漫记》). That agent may
-- open entries with its own ACN identity, instead of the daily loop depending
-- on someone holding the full-access Studio key.
ALTER TABLE "Column" ADD COLUMN "editorAgentId" TEXT;

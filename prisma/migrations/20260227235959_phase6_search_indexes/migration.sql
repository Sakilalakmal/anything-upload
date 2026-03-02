CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Video_search_fts_idx"
  ON "Video"
  USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX IF NOT EXISTS "User_search_fts_idx"
  ON "User"
  USING GIN (to_tsvector('simple', coalesce("username", '') || ' ' || coalesce("name", '')));

CREATE INDEX IF NOT EXISTS "Video_title_trgm_idx"
  ON "Video"
  USING GIN (lower("title") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Video_description_trgm_idx"
  ON "Video"
  USING GIN (lower(coalesce("description", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_username_trgm_idx"
  ON "User"
  USING GIN (lower(coalesce("username", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User"
  USING GIN (lower(coalesce("name", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_username_lower_idx"
  ON "User" (lower("username"));

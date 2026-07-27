ALTER TABLE user_state
  ALTER COLUMN data TYPE JSONB USING data::jsonb,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz,
  ALTER COLUMN updated_at SET DEFAULT now();

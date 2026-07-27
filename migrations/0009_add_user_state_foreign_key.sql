DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_state_user_id_fkey'
      AND conrelid = 'user_state'::regclass
  ) THEN
    ALTER TABLE user_state
      ADD CONSTRAINT user_state_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;
  END IF;
END
$$;

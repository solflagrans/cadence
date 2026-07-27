-- Preserve rows from the original TEXT-keyed state table.
DO $$
DECLARE
  legacy_row RECORD;
  identity_provider TEXT;
  identity_subject TEXT;
  mapped_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_state'
      AND column_name = 'user_id'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE user_state ADD COLUMN IF NOT EXISTS app_user_id UUID;

    FOR legacy_row IN
      SELECT user_id
      FROM user_state
      WHERE app_user_id IS NULL
    LOOP
      IF position(':' IN legacy_row.user_id) > 0 THEN
        identity_provider := split_part(legacy_row.user_id, ':', 1);
        identity_subject := substring(
          legacy_row.user_id
          FROM position(':' IN legacy_row.user_id) + 1
        );
      ELSE
        identity_provider := 'legacy';
        identity_subject := legacy_row.user_id;
      END IF;

      SELECT app_user_id
      INTO mapped_user_id
      FROM auth_identity
      WHERE provider = identity_provider
        AND subject = identity_subject;

      IF mapped_user_id IS NULL THEN
        INSERT INTO app_user DEFAULT VALUES
        RETURNING id INTO mapped_user_id;

        INSERT INTO auth_identity (provider, subject, app_user_id)
        VALUES (identity_provider, identity_subject, mapped_user_id);
      END IF;

      UPDATE user_state
      SET app_user_id = mapped_user_id
      WHERE user_id = legacy_row.user_id;
    END LOOP;

    ALTER TABLE user_state ALTER COLUMN app_user_id SET NOT NULL;
    ALTER TABLE user_state DROP CONSTRAINT IF EXISTS user_state_pkey;
    ALTER TABLE user_state DROP COLUMN user_id;
    ALTER TABLE user_state RENAME COLUMN app_user_id TO user_id;
    ALTER TABLE user_state ADD PRIMARY KEY (user_id);
  END IF;
END
$$;

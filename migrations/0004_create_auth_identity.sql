CREATE TABLE IF NOT EXISTS auth_identity (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  app_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);

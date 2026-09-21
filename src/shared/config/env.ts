import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(keys: string[]) {
    super(`Missing or invalid environment variables: ${keys.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

type Environment = Record<string, string | undefined>;

function parseConfig<T extends z.ZodType>(schema: T, source: Environment): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Report names only: Zod's raw diagnostics may contain secret values.
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  return result.data;
}

const databaseSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

const authSchema = z.object({
  NEON_AUTH_BASE_URL: z.url({ protocol: /^https$/ }),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
});

export function readDatabaseConfig(source: Environment = process.env) {
  return parseConfig(databaseSchema, source);
}

export function readAuthConfig(source: Environment = process.env) {
  return parseConfig(authSchema, source);
}

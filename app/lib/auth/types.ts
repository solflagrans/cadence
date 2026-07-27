export type AccountIdentity = {
  provider: "neon";
  subject: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AccountSession =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: AccountIdentity };

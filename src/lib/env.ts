export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasCoreEnv() {
  return Boolean(getEnv("NEXT_PUBLIC_SUPABASE_URL") && getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

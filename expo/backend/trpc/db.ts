export type DbConfig = {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

export function getDbConfig(): DbConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const cfg: DbConfig = {
    url,
    anonKey,
    serviceRoleKey,
  };

  console.log("[DB] getDbConfig (Supabase)", {
    hasUrl: !!url,
    hasAnonKey: !!anonKey,
    hasServiceRoleKey: !!serviceRoleKey,
  });

  return cfg;
}

export function isDbConfigured(): boolean {
  const { url, anonKey, serviceRoleKey } = getDbConfig();
  return !!(url && anonKey && serviceRoleKey);
}

export function getSupabaseHeaders(): Record<string, string> {
  const { anonKey, serviceRoleKey } = getDbConfig();
  return {
    "apikey": anonKey || "",
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
}

export function getSupabaseRestUrl(table: string): string {
  const { url } = getDbConfig();
  return `${url}/rest/v1/${table}`;
}

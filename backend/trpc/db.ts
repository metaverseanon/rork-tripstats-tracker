export type DbConfig = {
  endpoint?: string;
  namespace?: string;
  token?: string;
};

export function getDbConfig(): DbConfig {
  const endpoint =
    process.env.RORK_DB_ENDPOINT ??
    process.env.DB_ENDPOINT ??
    process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;

  const namespace =
    process.env.RORK_DB_NAMESPACE ??
    process.env.DB_NAMESPACE ??
    process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;

  const token =
    process.env.RORK_DB_TOKEN ??
    process.env.DB_TOKEN ??
    process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  const cfg: DbConfig = {
    endpoint,
    namespace,
    token,
  };

  console.log("[DB] getDbConfig", {
    hasEndpoint: !!endpoint,
    hasNamespace: !!namespace,
    hasToken: !!token,
  });

  return cfg;
}

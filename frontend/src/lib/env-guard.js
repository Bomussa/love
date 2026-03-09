const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

const PLACEHOLDER_VALUES = new Set(['your_supabase_anon_key', 'your_supabase_url']);

export class EnvConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EnvConfigurationError';
    this.details = details;
  }
}

function isMissing(value) {
  if (!value) return true;
  const normalized = String(value).trim();
  return !normalized || PLACEHOLDER_VALUES.has(normalized);
}

export function ensureSupabaseEnv(env = import.meta.env) {
  const missingVars = REQUIRED_ENV_VARS.filter((key) => isMissing(env?.[key]));

  if (missingVars.length > 0) {
    throw new EnvConfigurationError(
      `Missing required Supabase environment variables: ${missingVars.join(', ')}. Please configure them in Vercel for both Production and Preview environments, then redeploy.`,
      { missingVars },
    );
  }

  return {
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
  };
}

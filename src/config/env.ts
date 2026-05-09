import dotenv from 'dotenv';

dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  isDev: process.env.NODE_ENV !== 'production',

  supabase: {
    url: required('SUPABASE_URL'),
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  },

  google: {
    clientId:     process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:  process.env.GOOGLE_REDIRECT_URI ?? '',
  },

  frontendUrl: process.env.FRONTEND_URL ?? '',
};

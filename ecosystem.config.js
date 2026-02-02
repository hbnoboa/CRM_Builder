module.exports = {
  apps: [
    {
      name: 'crm-api',
      cwd: './apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://postgres:CrmBuilder2026SecurePass@localhost:5432/crm_builder?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'CrmBuilder2026SuperSecretKeyForJWTTokenGenerationPleaseChangeInProduction64chars',
        JWT_EXPIRES_IN: '7d',
        CORS_ORIGIN: '*',
      },
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'crm-web',
      cwd: './apps/web-admin/.next/standalone/apps/web-admin',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_API_URL: 'http://34.134.215.184/api/v1',
      },
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};

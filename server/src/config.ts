const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
};

const optional = (name: string, fallback: string): string =>
  process.env[name] ?? fallback;

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  webauthn: {
    rpId: required('WEBAUTHN_RP_ID'),
    rpName: required('WEBAUTHN_RP_NAME'),
    origin: required('WEBAUTHN_ORIGIN'),
  },
  corsOrigin: required('CORS_ORIGIN'),
  logLevel: optional('LOG_LEVEL', 'info'),
  maze: {
    width: parseInt(optional('MAZE_WIDTH', '20'), 10),
    height: parseInt(optional('MAZE_HEIGHT', '20'), 10),
  },
  itemCount: parseInt(optional('ITEM_COUNT', '10'), 10),
  monsterCount: parseInt(optional('MONSTER_COUNT', '6'), 10),
  // TODO: TBD - define session inactivity timeout before production
  sessionTimeoutHours: parseInt(optional('SESSION_TIMEOUT_HOURS', '24'), 10),
} as const;

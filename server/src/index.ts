import { assertRequiredEnvVars } from './middleware/security.js';
import { config } from './config.js';
import { logger } from './logger.js';

// Fail fast if any required env var is missing
assertRequiredEnvVars();

import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`Server listening`, { endpoint: `http://localhost:${config.port}` });
});

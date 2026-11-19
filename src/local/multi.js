import handler from '../multi.js';
import { initDatabase } from '../editions/multi/storage/schema.js';
import { makeSessionToken, sessionCookie } from '../editions/multi/auth/session.js';
import { createLocalPreview } from './preview.js';
export default createLocalPreview({
  edition: 'multi', handler, initDatabase,
  async memberCookie(env) { return sessionCookie(await makeSessionToken(env.ADMIN_TOKEN, 1)); },
});

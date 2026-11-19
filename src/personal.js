import handler from './editions/personal/entry.js';
import { createApplication } from './shared/application.js';
export default createApplication({ edition: 'personal', handler });

import handler from './editions/multi/entry.js';
import { createApplication } from './shared/application.js';
export default createApplication({ edition: 'multi', handler });

import handler from '../personal.js';
import { initDatabase } from '../editions/personal/storage/schema.js';
import { createLocalPreview } from './preview.js';
export default createLocalPreview({ edition: 'personal', handler, initDatabase });

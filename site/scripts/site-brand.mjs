import { resolve } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';

export const SITE_CONFIG = resolve(import.meta.dirname, '..', 'src', 'config.yaml');

export const siteBrand = () => brandFromDisk(SITE_CONFIG);

import { discoverRoutes } from '../scripts/gate.mjs';

export const routes: string[] = await discoverRoutes('dist');

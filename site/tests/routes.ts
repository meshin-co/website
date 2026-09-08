import { discoverRoutes } from '../scripts/gate.mjs';
import { templateRoutes } from '../scripts/templates.mjs';

export const routes: string[] = await discoverRoutes('dist');
export const templates: string[] = templateRoutes(routes);

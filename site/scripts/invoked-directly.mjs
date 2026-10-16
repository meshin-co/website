import { realpathSync } from 'node:fs';

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

export const invokedDirectly = (moduleFilename, argvPath) =>
  Boolean(argvPath) && real(moduleFilename) === real(argvPath);

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

export const licenseTextPath = (license, root = process.cwd()) => join(root, 'public', 'licenses', `${license}.txt`);

export function licenseTextShips(license, root) {
  try {
    return readFileSync(licenseTextPath(license, root), 'utf8').trim().length > 0;
  } catch {
    return false;
  }
}

export const licenseHasText = (entry, root) => entry.license === undefined || licenseTextShips(entry.license, root);

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TAIL_LINES = 20;
const HEAD_LINES = 15;
const COLOUR_CODE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const readIfPresent = (path) => {
  try {
    return readFileSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

export function fileTransaction(root) {
  const prior = new Map();
  const createdDirectories = [];
  const absolute = (path) => join(root, path);

  const track = (path) => {
    if (!prior.has(path)) prior.set(path, readIfPresent(absolute(path)));
  };

  const write = (path, text) => {
    track(path);
    const created = mkdirSync(dirname(absolute(path)), { recursive: true });
    if (created) createdDirectories.push(created);
    writeFileSync(absolute(path), text);
  };

  const restore = () => {
    for (const [path, content] of prior) {
      if (content === null) rmSync(absolute(path), { force: true });
      else writeFileSync(absolute(path), content);
    }
    for (const directory of createdDirectories) rmSync(directory, { recursive: true, force: true });
  };

  return { track, write, restore };
}

export const plainOutput = ({ stdout = '', stderr = '' }) => `${stdout}\n${stderr}`.replace(COLOUR_CODE, '').trim();

export const outputTail = (result) => plainOutput(result).split('\n').slice(-TAIL_LINES).join('\n');

export const outputHead = (result) => plainOutput(result).split('\n').slice(0, HEAD_LINES).join('\n');

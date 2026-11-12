import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { sha256Hex } from './spec-artefacts.mjs';

const SPEC_ROOT = 'spec';
const LISTED_ITEM = /data-artefact="([^"]+)"/g;
const DIGEST_ELEMENT = /<code\b[^>]*\bdata-artefact-digest\b[^>]*>([\s\S]*?)<\/code>/;
const SIDECAR_DIGEST = /SHA-256 `([^`]*)`/;
const NOT_FOUND = 'ENOENT';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function directoriesIn(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch((error) => {
    if (error.code === NOT_FOUND) return [];
    throw error;
  });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function textOf(path) {
  return readFile(path, 'utf8').catch((error) => {
    if (error.code === NOT_FOUND) return null;
    throw error;
  });
}

async function servedFiles(distDir, name, version) {
  const folder = join(distDir, SPEC_ROOT, name, version);
  const entries = await readdir(folder, { withFileTypes: true });
  const served = new Map();
  for (const entry of entries.filter((item) => item.isFile())) {
    const bytes = await readFile(join(folder, entry.name));
    served.set(`/${SPEC_ROOT}/${name}/${version}/${entry.name}`, sha256Hex(bytes));
  }
  return served;
}

function listedOnPage(html) {
  const marks = [...html.matchAll(LISTED_ITEM)];
  return new Map(
    marks.map((mark, index) => {
      const region = html.slice(mark.index, marks[index + 1]?.index ?? html.length);
      const shown = DIGEST_ELEMENT.exec(region);
      return [mark[1], shown ? shown[1].replace(/<[^>]*>/g, '').trim() : null];
    })
  );
}

function pageFindings({ page, html, served }) {
  const listed = listedOnPage(html);
  const findings = [];
  for (const path of listed.keys()) {
    if (!served.has(path)) findings.push(`${page} lists ${path}, which is not shipped`);
  }
  for (const [path, digest] of served) {
    if (!listed.has(path)) findings.push(`${page} does not list ${path}, which the build serves`);
    else findings.push(...digestFindings({ document: page, path, shown: listed.get(path), digest }));
  }
  return findings;
}

function digestFindings({ document, path, shown, digest }) {
  if (shown === null) return [`${document} shows no digest for ${path}`];
  if (shown === digest) return [];
  return [`${document} shows SHA-256 ${shown} for ${path}, but the served file hashes to ${digest}`];
}

function sidecarFindings({ sidecar, text, served }) {
  const findings = [];
  for (const [path, digest] of served) {
    const link = new RegExp(`\\]\\([^)]*${escapeRegExp(path)}\\)`);
    const lines = text.split('\n').filter((line) => link.test(line));
    if (lines.length === 0) {
      findings.push(`${sidecar} does not list ${path}, which the build serves`);
      continue;
    }
    const shown = lines.map((line) => SIDECAR_DIGEST.exec(line)?.[1]).filter((value) => value !== undefined);
    if (shown.length === 0) findings.push(`${sidecar} shows no digest for ${path}`);
    for (const value of shown) findings.push(...digestFindings({ document: sidecar, path, shown: value, digest }));
  }
  return findings;
}

async function versionFindings(distDir, name, version) {
  const served = await servedFiles(distDir, name, version);
  if (served.size === 0) return [];
  const page = `${SPEC_ROOT}/${name}/${version}.html`;
  const sidecar = `${SPEC_ROOT}/${name}/${version}.md`;
  const html = await textOf(join(distDir, page));
  const text = await textOf(join(distDir, sidecar));
  return [
    ...(html === null
      ? [`${page} is missing, so the files it should list are listed nowhere`]
      : pageFindings({ page, html, served })),
    ...(text === null
      ? [`${sidecar} is missing, so the files it should list are listed nowhere`]
      : sidecarFindings({ sidecar, text, served })),
  ];
}

export async function specArtefactFindings(distDir) {
  const findings = [];
  for (const name of await directoriesIn(join(distDir, SPEC_ROOT))) {
    for (const version of await directoriesIn(join(distDir, SPEC_ROOT, name))) {
      findings.push(...(await versionFindings(distDir, name, version)));
    }
  }
  return findings.sort();
}

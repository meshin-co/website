import { isHolding, normaliseTitle } from './autowriter-claims.mjs';
import { slugOfRecord } from './record-layout.mjs';

const refusal = (reason, against, detail) => ({ reason, against, detail });

function layerRefusal({ topic, generated, suffix }) {
  const key = normaliseTitle(topic.title, suffix);
  const owner = generated.find((row) => normaliseTitle(row.title, suffix) === key);
  if (!owner) return null;
  return refusal(
    'title-collision',
    owner.title,
    `title "${topic.title}" is already the title of ${owner.route} in the generated layer of docs/SEMANTIC-CORE.md ("${owner.title}")`
  );
}

function claimTitleRefusal({ topic, holders, suffix }) {
  const key = normaliseTitle(topic.title, suffix);
  const holder = holders.find(({ claim }) => normaliseTitle(claim.title, suffix) === key);
  if (!holder) return null;
  return refusal('title-collision', holder.claim.title, `title "${topic.title}" is also claimed by ${holder.path}`);
}

function claimSlugRefusal({ topic, holders }) {
  const holder = holders.find(({ claim }) => claim.slug === topic.slug);
  if (!holder) return null;
  const held = `${holder.claim.status === 'abandoned' ? 'abandoned, held' : 'claimed'} until ${holder.claim.expiresAt}`;
  const state = holder.claim.status === 'written' ? 'written' : held;
  return refusal('slug-held', holder.path, `slug "${topic.slug}" is held by ${holder.path} (${state})`);
}

function ledgerRefusal({ topic, ledgerPaths }) {
  const path = ledgerPaths.find((candidate) => slugOfRecord(candidate) === topic.slug);
  if (path === undefined) return null;
  return refusal(
    'slug-held',
    path,
    `slug "${topic.slug}" already has the ledger ${path}, so an earlier run owns it and the topic cannot be tried again yet; no procedure frees a slug safely, and removing the ledger is not one, because it records spend that the monthly spend ceiling counts`
  );
}

const CHECKS = [layerRefusal, claimTitleRefusal, claimSlugRefusal, ledgerRefusal];

export function claimRefusal(input) {
  const context = { ...input, holders: input.claims.filter(({ claim }) => isHolding(claim, input.now)) };
  for (const check of CHECKS) {
    const found = check(context);
    if (found) return found;
  }
  return null;
}

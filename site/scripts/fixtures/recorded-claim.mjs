import { readFileSync } from 'node:fs';

const RECORDED = JSON.parse(readFileSync(new URL('./recorded-claim-category.json', import.meta.url), 'utf8'));

export const recordedClaim = () => structuredClone(RECORDED);

export const promptlessClaim = (claim, fields = {}) =>
  JSON.parse(
    JSON.stringify({
      ...RECORDED,
      slug: claim.slug,
      title: claim.title,
      query: claim.query,
      claimedAt: claim.claimedAt,
      ...fields,
    })
  );

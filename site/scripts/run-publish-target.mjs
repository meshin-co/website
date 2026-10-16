import { appendFile } from 'node:fs/promises';

import { blockingFiles, pickGatedRun } from './publish-target.mjs';

const [repo, explicitRunId] = process.argv.slice(2);

const api = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) throw new Error(`publish: GET ${path} answered ${response.status}`);
  return response.json();
};

const hasDist = async (id) =>
  (await api(`actions/runs/${id}/artifacts`)).artifacts.some(({ name, expired }) => name === 'dist' && !expired);

const refuse = (message) => {
  console.error(`PUBLISH ${message}`);
  process.exit(1);
};

const candidates = explicitRunId
  ? [await api(`actions/runs/${explicitRunId}`)]
  : (await api('actions/workflows/ci.yml/runs?branch=main&status=success&per_page=20')).workflow_runs;

const withDist = [];
for (const candidate of candidates) withDist.push({ ...candidate, hasDist: await hasDist(candidate.id) });

const run = pickGatedRun(withDist);
if (!run)
  refuse(
    explicitRunId
      ? `run ${explicitRunId} is not a green ci run on main carrying an unexpired dist`
      : 'no green ci run on main carries an unexpired dist artifact'
  );

const tip = (await api('commits/main')).sha;
if (run.head_sha !== tip) {
  const { files = [] } = await api(`compare/${run.head_sha}...${tip}`);
  const blocking = blockingFiles(files.map(({ filename }) => filename));
  if (blocking.length > 0)
    refuse(
      `run ${run.id} measured ${run.head_sha.slice(0, 7)}, and main has moved on to ${tip.slice(0, 7)}, changing ${blocking.join(', ')}. Publish the gated run for the tip of main instead.`
    );
}

console.log(`publish: run ${run.id}, commit ${run.head_sha.slice(0, 7)}, tip ${tip.slice(0, 7)}`);
await appendFile(process.env.GITHUB_OUTPUT, `run_id=${run.id}\nsha=${run.head_sha}\n`);

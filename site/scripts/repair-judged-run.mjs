const JOBS_PER_PAGE = 100;
const GATE_STEP = /^Run npm run (gate:[a-z0-9-]+)$/;
const MERGE_REF = /\+([0-9a-f]{40}):refs\/remotes\/pull\/[1-9][0-9]*\/merge/;

const failedGates = (jobs) => [
  ...new Set(
    jobs.flatMap(({ steps = [] }) =>
      steps.filter(({ conclusion }) => conclusion === 'failure').flatMap(({ name }) => GATE_STEP.exec(name)?.[1] ?? [])
    )
  ),
];

async function mergeCommitOf(api, jobs) {
  for (const { id } of jobs) {
    const merge = MERGE_REF.exec((await api.bytes(`actions/jobs/${id}/logs`)).toString('utf8'))?.[1];
    if (merge !== undefined) return merge;
  }
  return undefined;
}

async function mainMeasuredBy(api, jobs) {
  const merge = await mergeCommitOf(api, jobs);
  if (merge === undefined) return undefined;
  const { parents } = await api.get(`commits/${merge}`);
  return parents[0]?.sha;
}

export async function readJudgedFacts({ api, run }) {
  try {
    const { jobs } = await api.get(`actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=${JOBS_PER_PAGE}`);
    const gates = failedGates(jobs);
    const measuredMain = await mainMeasuredBy(api, jobs);
    return {
      ...(gates.length === 1 ? { gate: gates[0] } : {}),
      ...(measuredMain === undefined ? {} : { measuredMain }),
    };
  } catch {
    return {};
  }
}

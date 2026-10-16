const fixture = JSON.parse(process.env.PUBLISH_FIXTURE);

const body = (path) => {
  if (path.includes('/artifacts')) {
    const id = path.match(/runs\/(\d+)\/artifacts/)[1];
    return { artifacts: fixture.artifacts[id] ?? [] };
  }
  if (path.includes('/runs?')) return { workflow_runs: fixture.runs };
  if (path.includes('/actions/runs/')) return fixture.byId[path.match(/runs\/(\d+)/)[1]];
  if (path.includes('/commits/main')) return { sha: fixture.tip };
  if (path.includes('/compare/')) return { files: fixture.compare ?? [] };
  throw new Error(`fixture: unexpected path ${path}`);
};

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => body(String(url)),
});

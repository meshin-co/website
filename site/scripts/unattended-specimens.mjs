import { join } from 'node:path';

const UNATTENDED = { AUTOWRITER_UNATTENDED: '1' };
const DISPOSITIONS = '../audits/phase-4.7/dispositions/main.json';
const LIGHTHOUSE_RECORD = '../audits/lighthouse-green.json';
const RECORD_PHASE = 'zz-specimen';
const LIGHTHOUSE_ROUTES = 'tests/guard-mutations/fixtures/lighthouse-specimen-routes.json';
const SEALED_DIGEST = /"digest": "([0-9a-f]{12})"/;
const STALE_DIGEST = '0'.repeat(12);

const staleDigest = (text) =>
  text.replace(SEALED_DIGEST, (_, digest) => `"digest": "${digest === STALE_DIGEST ? '1'.repeat(12) : STALE_DIGEST}"`);

const attempt = async () => async () => {};

const recordScene = async (request) => {
  const { recordScene: build } = await import('./lh-record-family.mjs');
  return (await build(request)).site;
};

export const unattendedSpecimens = ({ editFile, removeFile }) => ({
  unattendedSealsDispositions: {
    gate: 'assets:seal',
    plantedEnv: UNATTENDED,
    token: 'refusing to re-seal the dispositions',
    plant: (copySite) => editFile(join(copySite, DISPOSITIONS), staleDigest),
  },
  unattendedWritesLighthouseRecord: {
    gate: 'lh:record',
    env: { GATE_PHASE: RECORD_PHASE },
    plantedEnv: UNATTENDED,
    token: 'refusing to record the Lighthouse run',
    scene: recordScene,
    plant: (copySite) => removeFile(join(copySite, LIGHTHOUSE_RECORD)),
  },
  unattendedRunsTheLighthouseGate: {
    gate: 'gate:lh',
    env: { LH_ONLY_ROUTES: LIGHTHOUSE_ROUTES, GATE_PHASE: 'specimen' },
    plantedEnv: UNATTENDED,
    token: 'refusing to run the Lighthouse gate',
    plant: attempt,
  },
});

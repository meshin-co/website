import { join } from 'node:path';

const GATE = 'gate:schedule';
const WORKFLOW_PATH = '../.github/workflows/write-daily.yml';
const FIRST_CRON_MINUTE = /^( {4}- cron: ')(\d+)/m;

const withFirstMinuteMoved = (text) =>
  text.replace(FIRST_CRON_MINUTE, (_, before, minute) => `${before}${(Number(minute) + 1) % 60}`);

export const scheduleSpecimens = ({ editFile }) => ({
  scheduleCronHandEdited: {
    gate: GATE,
    token: 'SCHEDULE cron-differs .github/workflows/write-daily.yml',
    plant: (copySite) => editFile(join(copySite, WORKFLOW_PATH), withFirstMinuteMoved),
  },
});

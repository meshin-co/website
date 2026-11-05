import { join } from 'node:path';

const GATE = 'gate:schedule';
const WORKFLOW_PATH = '../.github/workflows/write-daily.yml';
const FIRST_CRON_MINUTE = /^( {4}- cron: ')(\d+)/m;
const LAST_CRON = /^( {4}- cron: '[^']*'\n)(?![^]* {4}- cron: )/m;
const SECOND_CRON = /^( {4}- cron: '[^']*'\n)( {4}- cron: '[^']*'\n)/m;

const withFirstMinuteMoved = (text) =>
  text.replace(FIRST_CRON_MINUTE, (_, before, minute) => `${before}${(Number(minute) + 1) % 60}`);

const withCatchUpWrittenByHand = (text) => text.replace(LAST_CRON, (line) => `${line}    - cron: '47 21 * * *'\n`);

const withFirstCatchUpRemoved = (text) => text.replace(SECOND_CRON, (_, first) => first);

export const scheduleSpecimens = ({ editFile }) => ({
  scheduleCronHandEdited: {
    gate: GATE,
    token: 'SCHEDULE cron-differs .github/workflows/write-daily.yml',
    plant: (copySite) => editFile(join(copySite, WORKFLOW_PATH), withFirstMinuteMoved),
  },
  scheduleCatchUpHandWritten: {
    gate: GATE,
    token: 'SCHEDULE cron-extra .github/workflows/write-daily.yml',
    plant: (copySite) => editFile(join(copySite, WORKFLOW_PATH), withCatchUpWrittenByHand),
  },
  scheduleCatchUpRemoved: {
    gate: GATE,
    token: 'SCHEDULE cron-missing .github/workflows/write-daily.yml',
    plant: (copySite) => editFile(join(copySite, WORKFLOW_PATH), withFirstCatchUpRemoved),
  },
});

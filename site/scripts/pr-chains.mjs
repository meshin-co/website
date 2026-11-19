export const CHAIN_CAP = 3;
export const CHAIN_REASONS = ['chain-alive', 'run-unattributed', 'chain-cap'];

const RUN_TITLE = /^Watch pull request #([1-9][0-9]*)$/;
const isActive = ({ status }) => status !== 'completed';

export function pullRequestOfRun({ title }) {
  const number = RUN_TITLE.exec(title)?.[1];
  return number === undefined ? null : Number(number);
}

export function chainBook(runs) {
  const active = runs.filter(isActive).map(pullRequestOfRun);
  const chains = new Set(active.filter((number) => number !== null));
  const unattributed = active.includes(null);
  return {
    isAlive: (number) => chains.has(number),
    began: (number) => void chains.add(number),
    refusal(number) {
      if (chains.has(number)) return 'chain-alive';
      if (unattributed) return 'run-unattributed';
      return chains.size >= CHAIN_CAP ? 'chain-cap' : null;
    },
  };
}

export function createChains(listRuns) {
  let book;
  const loaded = async () => (book ??= chainBook(await listRuns()));
  return {
    async refusal(number, forced) {
      const chains = await loaded();
      if (!forced) return chains.refusal(number);
      return chains.isAlive(number) ? 'chain-alive' : null;
    },
    async began(number) {
      (await loaded()).began(number);
    },
  };
}

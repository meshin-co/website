import { reportLines, runGate } from './human-gate.mjs';

const result = await runGate(process.argv[2] ?? 'dist');

for (const line of reportLines(result)) console.log(line);
process.exitCode = result.findings.length === 0 ? 0 : 1;

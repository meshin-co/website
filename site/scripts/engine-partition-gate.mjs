import { anchorsFor } from './engine-anchors.mjs';
import { recordProducer } from './engine-records.mjs';
import { IDENTITY_EXEMPT_RULES, isSeed, partition, seedTarget } from './engine-partition.mjs';
import { identityTermIn, readPartitionFacts } from './engine-partition-facts.mjs';

const BINARY = /\.(?:png|ico|ttf|woff2?|jpe?g|webp|avif|gif|pdf)$/;

const finding = (rule, where, detail) => ({ rule, where, detail });

function unclassifiedFindings(unclassified) {
  return unclassified.map((file) =>
    finding(
      'unclassified',
      file,
      'fits no rule: decide whether it is engine, site or evidence, then add the rule that derives it or the seed that serves it'
    )
  );
}

function siteBoundFindings({ rows, read, identity }) {
  return rows
    .filter((row) => row.class === 'engine' && !IDENTITY_EXEMPT_RULES.includes(row.rule) && !BINARY.test(row.file))
    .flatMap(({ file, rule }) => {
      const term = identityTermIn(read(file) ?? '', identity);
      return term === null
        ? []
        : [
            finding(
              'site-bound',
              file,
              `${rule} names "${term}", so it belongs to this site: move the fact into the site config or data, or seed the file`
            ),
          ];
    });
}

function serverOf(anchor, { files, classOf, facts }) {
  const inside = (file) => file === anchor.path || (anchor.kind === 'directory' && file.startsWith(`${anchor.path}/`));
  const shipped = files.find((file) => inside(file) && classOf.get(file) === 'engine' && !isSeed(file));
  if (shipped !== undefined) return shipped;
  const seed = files.find((file) => isSeed(file) && inside(seedTarget(file)));
  if (seed !== undefined) return seed;
  const seeded = [...facts.seeded].find(inside);
  if (seeded !== undefined) return seeded;
  if (facts.generatedOutputs.has(anchor.path)) return 'the assets script that writes it';
  return recordProducer(anchor.path, files);
}

function anchorFindings({ files, rows, facts }) {
  const classOf = new Map(rows.map((row) => [row.file, row.class]));
  const served = new Map();
  const findings = [];
  for (const anchor of anchorsFor(facts.config)) {
    const server = serverOf(anchor, { files, classOf, facts });
    if (server === null) {
      findings.push(
        finding(
          'anchor-unserved',
          anchor.path,
          `the engine reads it (${anchor.role}), and the export neither ships it, seeds it nor measures it: a new site fails gate:engine on arrival`
        )
      );
    } else {
      served.set(anchor.path, server);
    }
  }
  return { findings, served };
}

export function partitionReport({ files, read }) {
  const facts = readPartitionFacts({ files, read });
  const { rows, counts, unclassified } = partition(files, facts);
  const anchors = anchorFindings({ files, rows, facts });
  return {
    facts,
    rows,
    counts,
    served: anchors.served,
    findings: [
      ...unclassifiedFindings(unclassified),
      ...siteBoundFindings({ rows, read, identity: facts.identity }),
      ...anchors.findings,
    ],
  };
}

export function summaryLine({ counts, findings }) {
  const noun = findings.length === 1 ? 'finding' : 'findings';
  return `partition: ${counts.engine} engine, ${counts.site} site, ${counts.evidence} evidence files; ${findings.length} ${noun}`;
}

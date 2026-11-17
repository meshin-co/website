export const CHANGELOG = {
  id: 'changelog',
  heading: 'Changelog',
  columns: ['Version', 'Date', 'Change'],
  firstChange: 'First publication',
};

const day = (date) => date.toISOString().slice(0, 10);

const cell = (text) => text.replace(/\s+/g, ' ').replaceAll('|', '\\|');

const line = (cells) => `| ${cells.join(' | ')} |`;

export function changelogRows({ version, publishDate, corrections }) {
  return [
    { version, date: day(publishDate), change: CHANGELOG.firstChange },
    ...corrections.map(({ date, change }) => ({ version, date: day(date), change })),
  ];
}

export function changelogMarkdown(rows) {
  return [
    `## ${CHANGELOG.heading}`,
    '',
    line(CHANGELOG.columns),
    line(CHANGELOG.columns.map(() => '---')),
    ...rows.map(({ version, date, change }) => line([version, date, change].map(cell))),
    '',
  ].join('\n');
}

export function correctionsMatchDates({ publishDate, updatedDate, corrections }) {
  const times = [publishDate, ...corrections.map(({ date }) => date)].map((date) => date.getTime());
  const inOrder = times.every((time, index) => index === 0 || time >= times[index - 1]);
  return inOrder && updatedDate.getTime() === times.at(-1);
}

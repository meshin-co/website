import { recordPath } from '../record-layout.mjs';

const MONTH_DIRECTORY = /\/(\d{4}\/\d{2})\//;

export const filedAt = (date) => ({
  flat: (family, slug) => recordPath(family, slug, date).replace(MONTH_DIRECTORY, '/'),
  month: (family, slug) => recordPath(family, slug, date),
  deeper: (family, slug) => recordPath(family, slug, date).replace(MONTH_DIRECTORY, '/$1/extra/'),
});

export const PLACES = { flat: 'flat', month: 'in the month directory', deeper: 'below the month directory' };

import { join } from 'node:path';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { registerText, sealRegister } from './link-rot-register.mjs';

const REGISTER = '../audits/link-rot.json';

const handEditedRegister = () => {
  const sealed = sealRegister({
    updatedOn: '2026-11-03',
    rows: [
      {
        original: 'https://zz-specimen.example/gone',
        entry: 'site/src/data/glossary/zz-specimen.md',
        outcome: 'search',
        replacement: searchFallbackUrl({ title: 'A specimen report', publisher: 'Specimen Org' }),
        citedOn: '2023-03-01',
        firstSeenDead: '2026-11-03',
        why: 'no usable Internet Archive capture: the archive holds no snapshot of the address',
      },
    ],
  });
  const row = { ...sealed.rows[0], why: 'the claim beside it was checked by hand' };
  return registerText({ ...sealed, rows: [row] });
};

export const linkRotSpecimens = ({ addUntrackedFile }) => ({
  linksRegisterHandEdited: {
    gate: 'gate:links',
    token: 'LINKS register the digest does not match its rows',
    plant: (copySite) => addUntrackedFile(join(copySite, REGISTER), handEditedRegister()),
  },
});

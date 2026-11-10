import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TAG = 'ai-governance';
const FIRST_PAGE = `dist/blog/tag/${TAG}.html`;
const SECOND_PAGE = `dist/blog/tag/${TAG}/page/2.html`;
const SECOND_ROUTE = `/blog/tag/${TAG}/page/2`;
const ROUTES = 'dist/gate-routes.json';
const WORDING_FILE = 'src/utils/paginate.mjs';
const WORDING = "'{heading}, page {number}'";
const EDITED_WORDING = "'{heading} — page {number}'";
const HAND_WRITTEN = 'Specimen: a sentence a person wrote by hand on a numbered page.';
const HEADING = /<h1[^>]*>([^<]*)<\/h1>/;

const replaced = (text, from, to) => {
  if (!text.includes(from)) throw new Error(`a numbered-page specimen found no ${from} to change`);
  return text.replace(from, () => to);
};

function numberedPage(firstPage, number) {
  const found = HEADING.exec(firstPage);
  if (found === null) throw new Error(`the first page of ${TAG} has no h1 to number`);
  const numbered = `${found[1]}, page ${number}`;
  const titled = replaced(firstPage, `<title>${found[1]}`, `<title>${numbered}`);
  return replaced(titled, `>${found[1]}</h1>`, `>${numbered}</h1>`);
}

export const paginatedCopySpecimens = ({ addUntrackedFile, editFile }) => {
  const addNumberedPage = async ({ copySite }) => {
    const firstPage = await readFile(join(copySite, FIRST_PAGE), 'utf8');
    await addUntrackedFile(join(copySite, SECOND_PAGE), numberedPage(firstPage, 2));
    const routes = JSON.parse(await readFile(join(copySite, ROUTES), 'utf8'));
    await writeFile(join(copySite, ROUTES), JSON.stringify({ ...routes, routes: [...routes.routes, SECOND_ROUTE] }));
    return copySite;
  };

  return {
    numberedRouteHandWritten: {
      gate: 'gate:editorial',
      scene: addNumberedPage,
      token: `unreviewed copy (1): ${SECOND_ROUTE} | ${HAND_WRITTEN}`,
      plant: (copySite) =>
        editFile(join(copySite, SECOND_PAGE), (html) => replaced(html, '</h1>', `</h1><p>${HAND_WRITTEN}</p>`)),
    },
    paginationWordingEdited: {
      gate: 'gate:editorial',
      scene: addNumberedPage,
      token: `stale dispositions (1): ${WORDING_FILE}`,
      plant: (copySite) => editFile(join(copySite, WORDING_FILE), (text) => replaced(text, WORDING, EDITED_WORDING)),
    },
  };
};

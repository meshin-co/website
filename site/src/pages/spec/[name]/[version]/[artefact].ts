import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { isPublished } from '~/utils/feeds.mjs';
import { publishedArtefacts } from '~/utils/spec-artefacts.mjs';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const specs = await getCollection('spec', isPublished);
  return specs.flatMap((spec) =>
    publishedArtefacts(spec).map((artefact) => ({
      params: { name: spec.data.name, version: spec.data.version, artefact: artefact.file },
      props: { artefact },
    }))
  );
};

export const GET: APIRoute = ({ props }) =>
  new Response(props.artefact.bytes, { headers: { 'Content-Type': props.artefact.mediaType } });

export const ROUTE_EXCEPTIONS = [
  {
    route: '/404',
    reason:
      'The error page answers any address that does not exist, so it has no address of its own to list and nothing an answer engine should cite.',
  },
  {
    route: '/search',
    reason:
      'The search page is a client-side shell that builds its results in the browser from the search index, so it holds no fixed text to index.',
  },
  {
    route: '/styleguide',
    reason:
      'The styleguide is an internal component inventory for developers, not a page written to answer a buyer query.',
  },
];

export const EMPTY_COLLECTIONS = [
  {
    collection: 'case',
    reason:
      'No client has agreed in writing to a published case study and none is ever invented, so the hub stays withheld until the first real one exists.',
  },
];

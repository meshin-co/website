const comparable = (value) =>
  value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function catalogDriftFindings(catalog, builtByRoute) {
  return catalog.flatMap((entry) => {
    const built = builtByRoute[entry.path];
    if (!built)
      return [
        {
          rule: 'catalog-route-missing',
          route: entry.path,
          detail: `${entry.path} is in the catalog but did not build`,
        },
      ];
    if (comparable(built.description) === comparable(entry.description)) return [];
    return [
      {
        rule: 'catalog-description-drift',
        route: entry.path,
        detail: `catalog says "${entry.description}" but the page ships "${built.description}"`,
      },
    ];
  });
}

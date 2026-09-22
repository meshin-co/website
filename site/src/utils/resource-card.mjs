export function resourceCardProps(entry) {
  return {
    name: entry.data.name,
    summary: entry.data.description,
    format: entry.data.type,
    status: entry.data.status,
    href: `/resources/${entry.id}`,
  };
}

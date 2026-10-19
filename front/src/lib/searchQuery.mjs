// Preserve unrelated query parameters and the hash when updating search fields.
export function updateSearchQuery(href, changes) {
  const url = new URL(href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === "" || value == null) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

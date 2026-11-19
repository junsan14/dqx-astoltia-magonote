// Called only when a user explicitly selects a search candidate.
export function buildSearchSelection(label, source, field) {
  const term = String(label ?? "").trim();
  if (!term || !source || !field) return null;
  return {
    event: "site_search",
    search_term: term.slice(0, 100),
    search_source: source,
    search_field: field,
  };
}

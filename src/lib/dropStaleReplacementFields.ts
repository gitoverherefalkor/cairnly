// When the coach replaces a career on request (WF6, metadata.origin =
// "chat_replacement"), WF6 rewrites title + content but leaves the old row's
// `company_size_type`. The replaced card then shows the previous career's
// descriptor (live test 2026-11-07: "Renewable Energy Interconnection
// Specialist" labelled "Small (11-50) / Games" from the Game Developer it
// replaced). WF6 never writes that field, so on a replacement it is stale by
// definition: hide it everywhere sections are loaded.

interface SectionLike {
  company_size_type?: string | null;
  metadata?: { origin?: string } | null;
}

export function dropStaleReplacementFields<T extends SectionLike>(section: T): T {
  if (section?.metadata?.origin !== 'chat_replacement' || !section.company_size_type) return section;
  return { ...section, company_size_type: null };
}

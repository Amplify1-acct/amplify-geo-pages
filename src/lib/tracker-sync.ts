type TrackerEntry = { id: string; createdAt: string; updatedAt?: string };

// Remote repairs must replace stale browser errors, while unsaved local edits win
// when they are newer. Keep object identity when nothing actually changed.
export function reconcileTrackerSnapshot<T extends TrackerEntry>(local: T[], remote: T[], deletedIds: string[] = []): T[] {
  const deleted = new Set(deletedIds);
  const merged = new Map(local.filter(row => !deleted.has(row.id)).map(row => [row.id, row]));
  for (const row of remote) {
    if (deleted.has(row.id)) continue;
    const current = merged.get(row.id);
    if (!current || Date.parse(row.updatedAt || row.createdAt) > Date.parse(current.updatedAt || current.createdAt)) merged.set(row.id, row);
  }
  const next = [...merged.values()];
  return next.length === local.length && next.every((row, index) => row === local[index]) ? local : next;
}

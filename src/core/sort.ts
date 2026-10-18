import type { Item, SortMode } from './types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function byName(a: Item, b: Item): number {
	return collator.compare(a.name, b.name) || collator.compare(a.folder, b.folder);
}

function byModified(a: Item, b: Item): number {
	// Unresolved links have no file, so no date: keep them after real notes.
	if (a.unresolved !== b.unresolved) return a.unresolved ? 1 : -1;
	return b.mtime - a.mtime || byName(a, b);
}

function byAppearance(a: Item, b: Item): number {
	const ao = a.firstOffset;
	const bo = b.firstOffset;
	if (ao === null && bo === null) return byName(a, b);
	if (ao === null) return 1;
	if (bo === null) return -1;
	return ao - bo || byName(a, b);
}

/** Returns a new array sorted within one group. */
export function sortItems(items: readonly Item[], mode: SortMode): Item[] {
	const copy = items.slice();
	switch (mode) {
		case 'az':
			return copy.sort(byName);
		case 'za':
			return copy.sort((a, b) => byName(b, a));
		case 'modified':
			return copy.sort(byModified);
		case 'appearance':
			return copy.sort(byAppearance);
	}
}

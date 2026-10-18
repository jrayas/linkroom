import type { Range } from './types';

/** A note the switcher can offer. */
export interface NoteEntry {
	path: string;
	name: string;
	folder: string;
	aliases: string[];
}

export interface MatchResult {
	score: number;
	matches: Range[];
}

/** Built once per query; returns null when the text does not match. Obsidian's prepareFuzzySearch fits. */
export type MatcherFactory = (query: string) => (text: string) => MatchResult | null;

export type MatchField = 'name' | 'alias' | 'path';

export interface NoteMatch {
	entry: NoteEntry;
	field: MatchField;
	/** The text that matched: the name, one alias, or the path without `.md`. */
	text: string;
	score: number;
	matches: Range[];
}

const FIELD_ORDER: Record<MatchField, number> = { name: 0, alias: 1, path: 2 };
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function pathWithoutExtension(path: string): string {
	return path.toLowerCase().endsWith('.md') ? path.slice(0, -3) : path;
}

function bestMatch(entry: NoteEntry, match: (text: string) => MatchResult | null): NoteMatch | null {
	let best: NoteMatch | null = null;
	const consider = (field: MatchField, text: string): void => {
		const r = match(text);
		if (!r) return;
		if (!best || r.score > best.score || (r.score === best.score && FIELD_ORDER[field] < FIELD_ORDER[best.field])) {
			best = { entry, field, text, score: r.score, matches: r.matches };
		}
	};
	consider('name', entry.name);
	for (const alias of entry.aliases) consider('alias', alias);
	consider('path', pathWithoutExtension(entry.path));
	return best;
}

/**
 * Ranks notes for the switcher (D-38): each note scores on its name, aliases and
 * path; the best field wins. Ties prefer name over alias over path, then the
 * shorter name, then alphabetical order.
 */
export function rankNotes(entries: readonly NoteEntry[], query: string, makeMatcher: MatcherFactory, limit: number): NoteMatch[] {
	const q = query.trim();
	if (q === '') return [];
	const match = makeMatcher(q);
	const found: NoteMatch[] = [];
	for (const entry of entries) {
		const m = bestMatch(entry, match);
		if (m) found.push(m);
	}
	found.sort((a, b) =>
		b.score - a.score
		|| FIELD_ORDER[a.field] - FIELD_ORDER[b.field]
		|| a.entry.name.length - b.entry.name.length
		|| collator.compare(a.entry.name, b.entry.name));
	return found.slice(0, limit);
}

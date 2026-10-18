import { describe, expect, it } from 'vitest';
import { rankNotes, type MatcherFactory, type NoteEntry } from '../../src/core/switcher';

// A stand-in for prepareFuzzySearch: case-insensitive substring, earlier and tighter is better.
const substring: MatcherFactory = (q) => (text) => {
	const at = text.toLowerCase().indexOf(q.toLowerCase());
	return at === -1 ? null : { score: -at - text.length / 100, matches: [[at, at + q.length]] };
};

const note = (path: string, aliases: string[] = []): NoteEntry => {
	const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
	const i = path.lastIndexOf('/');
	return { path, name: file, folder: i === -1 ? '' : path.slice(0, i), aliases };
};

const notes = [
	note('Travel/Packing List.md'),
	note('Journal/2026/Travel Journal.md'),
	note('Trip Plan.md'),
	note('Travel/Bookings/Hotel Booking.md', ['Booking', 'Hotel']),
	note('Weekend Ideas.md'),
];

describe('rankNotes', () => {
	it('returns nothing for an empty query', () => {
		expect(rankNotes(notes, '   ', substring, 10)).toEqual([]);
	});

	it('prefers a match at the start of the name', () => {
		const r = rankNotes(notes, 'trav', substring, 10);
		expect(r[0]?.entry.name).toBe('Travel Journal');
		expect(r[0]?.field).toBe('name');
		expect(r[0]?.matches).toEqual([[0, 4]]);
	});

	it('finds notes through their folder path', () => {
		const r = rankNotes(notes, 'trav', substring, 10);
		const packing = r.find((m) => m.entry.name === 'Packing List');
		expect(packing?.field).toBe('path');
		expect(packing?.text).toBe('Travel/Packing List');
	});

	it('finds notes through an alias', () => {
		const r = rankNotes(notes, 'hotel', substring, 10);
		expect(r[0]?.entry.name).toBe('Hotel Booking');
		const byAlias = rankNotes([note('Stay.md', ['Hotel'])], 'hotel', substring, 10);
		expect(byAlias[0]?.field).toBe('alias');
		expect(byAlias[0]?.text).toBe('Hotel');
	});

	it('prefers the name when name and alias score the same', () => {
		const r = rankNotes([note('Hotel.md', ['Hotel'])], 'hotel', substring, 10);
		expect(r[0]?.field).toBe('name');
	});

	it('limits the number of results', () => {
		expect(rankNotes(notes, 'e', substring, 2).length).toBe(2);
	});

	it('drops notes that do not match', () => {
		expect(rankNotes(notes, 'zzz', substring, 10)).toEqual([]);
	});
});

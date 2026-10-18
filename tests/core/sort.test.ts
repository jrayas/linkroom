import { describe, expect, it } from 'vitest';
import { sortItems } from '../../src/core/sort';
import { item } from './helpers';

const n = (xs: { name: string }[]): string[] => xs.map((x) => x.name);

describe('sortItems', () => {
	const items = [item('Day 10'), item('day 2'), item('Éclair'), item('apple')];

	it('sorts alphabetically with numbers and accents', () => {
		expect(n(sortItems(items, 'az'))).toEqual(['apple', 'day 2', 'Day 10', 'Éclair']);
	});

	it('sorts in reverse', () => {
		expect(n(sortItems(items, 'za'))).toEqual(['Éclair', 'Day 10', 'day 2', 'apple']);
	});

	it('sorts by modified, ties by name, unresolved last', () => {
		const xs = [item('B', { mtime: 5 }), item('U', { unresolved: true }), item('A', { mtime: 5 }), item('C', { mtime: 9 })];
		expect(n(sortItems(xs, 'modified'))).toEqual(['C', 'A', 'B', 'U']);
	});

	it('sorts by appearance with frontmatter first and missing offsets last', () => {
		const xs = [item('B', { firstOffset: 30 }), item('F', { firstOffset: -1 }), item('N', { firstOffset: null }), item('A', { firstOffset: 10 })];
		expect(n(sortItems(xs, 'appearance'))).toEqual(['F', 'A', 'B', 'N']);
	});

	it('does not mutate its input', () => {
		const xs = [item('B'), item('A')];
		sortItems(xs, 'az');
		expect(n(xs)).toEqual(['B', 'A']);
	});
});

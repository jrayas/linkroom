import { describe, expect, it } from 'vitest';
import { isNavKey, nextIndex } from '../../src/core/grid-nav';

describe('nextIndex', () => {
	// Two sections: 5 items and 3 items, 2 columns.
	// rows: [0,1] [2,3] [4] | [5,6] [7]
	const blocks = [5, 3];
	it('moves left and right in reading order, clamped', () => {
		expect(nextIndex(blocks, 2, 0, 'ArrowLeft')).toBe(0);
		expect(nextIndex(blocks, 2, 1, 'ArrowRight')).toBe(2);
		expect(nextIndex(blocks, 2, 7, 'ArrowRight')).toBe(7);
	});
	it('moves up and down in the same column across sections', () => {
		expect(nextIndex(blocks, 2, 1, 'ArrowDown')).toBe(3);
		expect(nextIndex(blocks, 2, 3, 'ArrowDown')).toBe(4);
		expect(nextIndex(blocks, 2, 4, 'ArrowDown')).toBe(5);
		expect(nextIndex(blocks, 2, 6, 'ArrowUp')).toBe(4);
		expect(nextIndex(blocks, 2, 6, 'ArrowDown')).toBe(7);
		expect(nextIndex(blocks, 2, 0, 'ArrowUp')).toBe(0);
	});
	it('handles Home and End', () => {
		expect(nextIndex(blocks, 2, 3, 'Home')).toBe(0);
		expect(nextIndex(blocks, 2, 3, 'End')).toBe(7);
	});
	it('returns -1 with no items', () => {
		expect(nextIndex([0], 2, 0, 'ArrowDown')).toBe(-1);
	});
	it('recognises navigation keys', () => {
		expect(isNavKey('ArrowUp')).toBe(true);
		expect(isNavKey('Enter')).toBe(false);
	});
});

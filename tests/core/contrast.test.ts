import { describe, expect, it } from 'vitest';
import { contrastRatio, isReadableText, parseColour, toHex } from '../../src/core/contrast';

describe('contrast', () => {
	it('parses hex, rgb and hsl', () => {
		expect(parseColour('#fff')).toEqual({ r: 255, g: 255, b: 255 });
		expect(parseColour('#7C6BF2')).toEqual({ r: 124, g: 107, b: 242 });
		expect(parseColour('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
		expect(parseColour('rgba(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30 });
		expect(toHex(parseColour('hsl(0, 100%, 50%)') ?? { r: 0, g: 0, b: 0 })).toBe('#ff0000');
		expect(parseColour('nonsense')).toBeNull();
	});
	it('computes known ratios', () => {
		const black = { r: 0, g: 0, b: 0 };
		const white = { r: 255, g: 255, b: 255 };
		expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
		expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
	});
	it('decides whether a link colour is readable as text', () => {
		expect(isReadableText('#5b3fd6', '#ffffff')).toBe(true);
		expect(isReadableText('#e0e0ff', '#ffffff')).toBe(false);
		// Obsidian's default dark accent: below AA for body text, above the 3 to 1 link floor (D-48).
		expect(isReadableText('rgb(138, 92, 245)', 'rgb(30, 30, 30)')).toBe(false);
		expect(isReadableText('rgb(138, 92, 245)', 'rgb(30, 30, 30)', 3)).toBe(true);
		expect(isReadableText('#e0e0ff', '#ffffff', 3)).toBe(false);
		expect(isReadableText('bad', '#fff')).toBe(true);
	});
});

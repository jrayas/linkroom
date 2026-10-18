import { describe, expect, it } from 'vitest';
import { sanitiseFontFamily } from '../../src/core/font';

describe('sanitiseFontFamily', () => {
	it('keeps normal values', () => {
		expect(sanitiseFontFamily('"Inter", sans-serif')).toBe('"Inter", sans-serif');
	});
	it('strips characters that could break out of the declaration', () => {
		expect(sanitiseFontFamily('Inter; } body { color: red')).toBe('Inter  body  color: red');
	});
	it('removes unbalanced quotes', () => {
		expect(sanitiseFontFamily('"Inter, serif')).toBe('Inter, serif');
	});
	it('returns empty for empty input', () => {
		expect(sanitiseFontFamily('  ;; ')).toBe('');
	});
});

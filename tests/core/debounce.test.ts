import { describe, expect, it } from 'vitest';
import { debounce } from '../../src/core/debounce';
import { FakeTimers } from './helpers';

describe('debounce', () => {
	it('fires once after the delay', () => {
		const t = new FakeTimers();
		let n = 0;
		const d = debounce(() => n++, 100, t);
		d.call(); t.advance(50); d.call(); t.advance(99);
		expect(n).toBe(0);
		t.advance(1);
		expect(n).toBe(1);
	});
	it('cancels and flushes', () => {
		const t = new FakeTimers();
		let n = 0;
		const d = debounce(() => n++, 100, t);
		d.call(); d.cancel(); t.advance(200);
		expect(n).toBe(0);
		d.call(); expect(d.pending()).toBe(true); d.flush();
		expect(n).toBe(1);
		d.flush();
		expect(n).toBe(1);
	});
});

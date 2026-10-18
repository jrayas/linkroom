import { describe, expect, it } from 'vitest';
import { Store } from '../../src/store';
import type { StoredData } from '../../src/core/types';
import { FakeTimers } from './helpers';

function make(initial: unknown): { store: Store; saved: StoredData[]; timers: FakeTimers } {
	const timers = new FakeTimers();
	const saved: StoredData[] = [];
	const store = new Store(() => Promise.resolve(initial), (d) => { saved.push(d); return Promise.resolve(); }, timers);
	return { store, saved, timers };
}

describe('Store', () => {
	it('saves debounced and notifies listeners', async () => {
		const { store, saved, timers } = make(undefined);
		await store.load();
		const kinds: string[] = [];
		store.subscribe((k) => kinds.push(k));
		store.updateViewState({ columns: '3' });
		store.updateViewState({ columns: '4' });
		expect(saved.length).toBe(0);
		timers.advance(300);
		expect(saved.length).toBe(1);
		expect(saved[0]?.viewState.columns).toBe('4');
		expect(kinds).toEqual(['viewState', 'viewState']);
	});
	it('ignores no-op and invalid updates', async () => {
		const { store, timers, saved } = make(undefined);
		await store.load();
		store.updateViewState({ columns: '2' });
		store.updateSettings({ fontSize: 'huge' as 'large' });
		timers.advance(1000);
		expect(saved.length).toBe(0);
		expect(store.settings.fontSize).toBe('medium');
	});
	it('updates defaults and resets everything', async () => {
		const { store } = make({ settings: { fontSize: 'large' }, viewState: { columns: '1' } });
		await store.load();
		store.updateDefaults({ sort: 'modified' });
		expect(store.settings.defaults.sort).toBe('modified');
		store.resetAll();
		expect(store.settings.fontSize).toBe('medium');
		expect(store.viewState.columns).toBe('2');
	});
	it('flushes a pending save', async () => {
		const { store, saved } = make(undefined);
		await store.load();
		store.updateSettings({ openOnStartup: true });
		store.flush();
		expect(saved.length).toBe(1);
	});
});

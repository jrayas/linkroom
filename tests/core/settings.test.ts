import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_VIEW_STATE, loadData, migrate, validateSettings } from '../../src/core/settings';

describe('settings', () => {
	it('fills defaults for empty data', () => {
		const d = loadData(undefined, true);
		expect(d.schemaVersion).toBe(2);
		expect(d.settings).toEqual(DEFAULT_SETTINGS);
		expect(d.viewState).toEqual(DEFAULT_VIEW_STATE);
	});
	it('merges stored values over defaults', () => {
		const d = loadData({ schemaVersion: 1, settings: { fontSize: 'large' }, viewState: { columns: '4' } }, false);
		expect(d.settings.fontSize).toBe('large');
		expect(d.settings.rowSpacing).toBe('comfortable');
		expect(d.viewState.columns).toBe('4');
	});
	it('falls back for every invalid value', () => {
		const s = validateSettings({
			fontFamily: 'comic', fontSize: 3, customLinkColour: 'red', maxWrapLines: 5, linkStyle: 'neon',
			wrapLongNames: 'yes', defaults: { columns: '7', sort: 'random' },
		});
		expect(s.fontFamily).toBe('interface');
		expect(s.fontSize).toBe('medium');
		expect(s.customLinkColour).toBe('');
		expect(s.linkStyle).toBe('hairline');
		expect(s.maxWrapLines).toBe(2);
		expect(s.wrapLongNames).toBe(false);
		expect(s.defaults.columns).toBe('2');
		expect(s.defaults.sort).toBe('az');
	});
	it('stamps the current schema version', () => {
		expect(migrate({ settings: {} }).schemaVersion).toBe(2);
		expect(migrate('garbage').schemaVersion).toBe(2);
	});
	it('migrates version 1 data (D-47)', () => {
		const v1 = { schemaVersion: 1, settings: { underlineColourMode: 'custom', customUnderlineColour: '#123456', keepSearch: true, fontSize: 'large' }, viewState: { columns: '3' } };
		const d = loadData(v1, false);
		expect(d.schemaVersion).toBe(2);
		expect(d.settings.linkColourMode).toBe('custom');
		expect(d.settings.customLinkColour).toBe('#123456');
		expect(d.settings.linkStyle).toBe('hairline');
		expect(d.settings.fontSize).toBe('large');
		expect('keepSearch' in d.settings).toBe(false);
		expect('underlineColourMode' in d.settings).toBe(false);
		expect(d.viewState.showBoth).toBe(true);
		expect(d.viewState.columns).toBe('3');
	});
	it('applies "Start with: Defaults" at startup only', () => {
		const raw = {
			settings: { startWith: 'defaults', defaults: { columns: '3', sort: 'za', showFolders: true, showHeadings: false, showAliases: true } },
			viewState: { columns: '1', showBoth: false, showOutgoing: false, showBacklinks: false },
		};
		const atStart = loadData(raw, true).viewState;
		expect(atStart).toEqual({ columns: '3', sort: 'za', showFolders: true, showHeadings: false, showAliases: true, showBoth: true, showOutgoing: true, showBacklinks: true });
		expect(loadData(raw, false).viewState.columns).toBe('1');
	});
});

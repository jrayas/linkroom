import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/core/model';
import { DEFAULT_VIEW_STATE } from '../../src/core/settings';
import { raw, snap } from './helpers';

const opts = { hideUnresolved: false, duplicateFolders: 'auto' as const };
const names = (m: ReturnType<typeof buildModel>, i: number): string[] => m.sections[i]?.items.map((x) => x.name) ?? [];
const out = (m: ReturnType<typeof buildModel>): string[] => m.sections.find((s) => s.kind === 'outgoing')?.items.map((x) => x.name) ?? [];
const outItems = (m: ReturnType<typeof buildModel>) => m.sections.find((s) => s.kind === 'outgoing')?.items ?? [];

describe('buildModel', () => {
	it('returns no sections without a target', () => {
		const m = buildModel({ target: null, outgoing: [], backlinks: [] }, DEFAULT_VIEW_STATE, opts);
		expect(m.sections).toEqual([]);
		expect(m.targetPath).toBeNull();
	});

	it('dedupes a file linked in several ways and keeps the first offset', () => {
		const m = buildModel(snap([
			raw('Hotel Booking.md', { firstOffset: 40 }),
			raw('Hotel Booking.md', { firstOffset: 10 }),
		]), DEFAULT_VIEW_STATE, opts);
		expect(out(m)).toEqual(['Hotel Booking']);
		expect(outItems(m)[0]?.firstOffset).toBe(10);
	});

	it('removes self-links and non-markdown files', () => {
		const m = buildModel(snap([raw('Trip Plan.md'), raw('photo.png'), raw('Board.canvas'), raw('A.md')]), DEFAULT_VIEW_STATE, opts);
		expect(out(m)).toEqual(['A']);
	});

	it('keeps unresolved markdown links and drops unresolved attachments', () => {
		const m = buildModel(snap([
			raw(null, { linkText: 'Currency Notes' }),
			raw(null, { linkText: 'currency notes#Rates' }),
			raw(null, { linkText: 'missing.png' }),
			raw(null, { linkText: 'Other.md' }),
		]), DEFAULT_VIEW_STATE, opts);
		expect(out(m)).toEqual(['Currency Notes', 'Other']);
		expect(outItems(m).every((i) => i.unresolved)).toBe(true);
	});

	it('hides unresolved links when asked', () => {
		const m = buildModel(snap([raw(null, { linkText: 'Gone' }), raw('A.md')]), DEFAULT_VIEW_STATE, { ...opts, hideUnresolved: true });
		expect(out(m)).toEqual(['A']);
	});

	it('puts notes linked both ways in their own group, once (D-42)', () => {
		const m = buildModel(snap([raw('A.md'), raw('Out.md')], [raw('A.md'), raw('In.md')]), DEFAULT_VIEW_STATE, opts);
		expect(m.sections.map((s) => s.kind)).toEqual(['both', 'outgoing', 'backlinks']);
		expect(names(m, 0)).toEqual(['A']);
		expect(names(m, 1)).toEqual(['Out']);
		expect(names(m, 2)).toEqual(['In']);
		expect(m.sections[0]?.items[0]?.key).toBe('both:A.md');
		expect(m.sections[0]?.items[0]?.needsFolder).toBe(false);
	});

	it('never treats unresolved links as both ways', () => {
		const m = buildModel(snap([raw(null, { linkText: 'Ghost' })], [raw('Ghost.md')]), DEFAULT_VIEW_STATE, opts);
		expect(names(m, 0)).toEqual([]);
		expect(names(m, 1)).toEqual(['Ghost']);
		expect(m.sections[1]?.items[0]?.unresolved).toBe(true);
	});

	it('hides mutual notes entirely when Both ways is off', () => {
		const m = buildModel(snap([raw('A.md'), raw('Out.md')], [raw('A.md'), raw('In.md')]), { ...DEFAULT_VIEW_STATE, showBoth: false }, opts);
		expect(m.sections.map((s) => s.kind)).toEqual(['outgoing', 'backlinks']);
		expect(names(m, 0)).toEqual(['Out']);
		expect(names(m, 1)).toEqual(['In']);
	});

	it('orders both ways by their outgoing offset under order in note', () => {
		const m = buildModel(snap([raw('Z.md', { firstOffset: 1 }), raw('A.md', { firstOffset: 9 })], [raw('A.md'), raw('Z.md')]),
			{ ...DEFAULT_VIEW_STATE, sort: 'appearance' }, opts);
		expect(names(m, 0)).toEqual(['Z', 'A']);
	});

	it('respects the group toggles', () => {
		const m = buildModel(snap([raw('A.md')], [raw('B.md')]), { ...DEFAULT_VIEW_STATE, showOutgoing: false }, opts);
		expect(m.sections.map((s) => s.kind)).toEqual(['both', 'backlinks']);
	});

	it('marks duplicate names across groups, case-insensitively', () => {
		const m = buildModel(snap([raw('Work/Meeting.md'), raw('B.md')], [raw('Home/meeting.md')]), DEFAULT_VIEW_STATE, opts);
		const out = m.sections.find((s) => s.kind === 'outgoing');
		const back = m.sections.find((s) => s.kind === 'backlinks');
		expect(out?.items.find((i) => i.name === 'Meeting')?.needsFolder).toBe(true);
		expect(back?.items[0]?.needsFolder).toBe(true);
		expect(out?.items.find((i) => i.name === 'B')?.needsFolder).toBe(false);
	});

	it('does not mark duplicates when set to never', () => {
		const m = buildModel(snap([raw('Work/Meeting.md'), raw('Home/Meeting.md')]), DEFAULT_VIEW_STATE, { ...opts, duplicateFolders: 'never' });
		expect(outItems(m).some((i) => i.needsFolder)).toBe(false);
	});

	it('sorts backlinks by name under order in note', () => {
		const m = buildModel(snap([raw('Z.md', { firstOffset: 1 }), raw('A.md', { firstOffset: 9 })], [raw('Y.md'), raw('B.md')]),
			{ ...DEFAULT_VIEW_STATE, sort: 'appearance' }, opts);
		expect(names(m, 1)).toEqual(['Z', 'A']);
		expect(names(m, 2)).toEqual(['B', 'Y']);
	});

	it('changes signature when content changes and not otherwise', () => {
		const a = buildModel(snap([raw('A.md')]), DEFAULT_VIEW_STATE, opts);
		const b = buildModel(snap([raw('A.md')]), DEFAULT_VIEW_STATE, opts);
		const c = buildModel(snap([raw('A.md', { aliases: ['x'] })]), DEFAULT_VIEW_STATE, opts);
		expect(a.signature).toBe(b.signature);
		expect(a.signature).not.toBe(c.signature);
	});
});

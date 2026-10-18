import { DropdownComponent, setIcon, setTooltip, ToggleComponent, type Component } from 'obsidian';
import { COLUMN_OPTIONS, SORT_MODES } from '../core/settings';
import type { Columns, SortMode, ViewState } from '../core/types';
import type { Store } from '../store';
import { COPY } from './copy';

type ToggleKey = 'showFolders' | 'showHeadings' | 'showAliases' | 'showBoth' | 'showOutgoing' | 'showBacklinks';

const TOGGLES: [ToggleKey, string][] = [
	['showFolders', 'Show folders'],
	['showHeadings', 'Show headings'],
	['showAliases', 'Show aliases'],
	['showBoth', 'Both ways'],
	['showOutgoing', 'Outgoing'],
	['showBacklinks', 'Backlinks'],
];

let popoverCount = 0;

/** The gear in the top-right corner and its quick-toggle panel (04-settings, part 1). */
export class Popover {
	readonly gear: HTMLElement;
	private panel: HTMLElement;
	private toggles = new Map<ToggleKey, ToggleComponent>();
	private sort: DropdownComponent;
	private columnButtons = new Map<Columns, HTMLElement>();
	private uid = `lr-pop-${++popoverCount}`;
	private rows = 0;

	constructor(wrap: HTMLElement, owner: Component, private store: Store) {
		this.gear = wrap.createEl('button', {
			cls: 'clickable-icon lr-gear',
			attr: { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
		});
		setIcon(this.gear, 'settings');
		setTooltip(this.gear, COPY.viewOptions, { placement: 'left' });

		const titleId = `${this.uid}-title`;
		this.panel = wrap.createDiv({ cls: 'lr-popover', attr: { role: 'dialog', 'aria-labelledby': titleId } });
		this.panel.createDiv({ cls: 'lr-sr-only', text: COPY.viewOptions, attr: { id: titleId } });

		for (const [key, label] of TOGGLES) {
			const row = this.row(label);
			const t = new ToggleComponent(row).onChange((v) => {
				if (this.store.viewState[key] !== v) this.store.updateViewState({ [key]: v });
			});
			this.label(t, row);
			this.toggles.set(key, t);
		}

		this.panel.createDiv({ cls: 'lr-pop-gap' });
		const sortRow = this.row('Sort');
		this.sort = new DropdownComponent(sortRow);
		for (const m of SORT_MODES) this.sort.addOption(m, COPY.sort[m]);
		this.sort.onChange((v) => this.store.updateViewState({ sort: v as SortMode }));
		this.label(this.sort, sortRow);

		const colRow = this.row('Columns');
		const seg = colRow.createDiv({ cls: 'lr-seg', attr: { role: 'group' } });
		seg.setAttr('aria-labelledby', colRow.querySelector('.lr-pop-label')?.id ?? '');
		for (const c of COLUMN_OPTIONS) {
			const b = seg.createEl('button', { cls: 'lr-seg-btn', text: c === 'auto' ? 'Auto' : c });
			owner.registerDomEvent(b, 'click', () => this.store.updateViewState({ columns: c }));
			this.columnButtons.set(c, b);
		}

		owner.registerDomEvent(this.gear, 'click', () => this.toggle());
		owner.registerDomEvent(this.panel, 'keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				this.close(true);
			}
		});
		// Non-modal: a press anywhere outside closes it. Uses the view's own document (pop-out safe).
		owner.registerDomEvent(wrap.doc, 'pointerdown', (e) => {
			if (this.isOpen() && e.target instanceof Node && !wrap.contains(e.target)) this.close(false);
		});
		this.sync();
	}

	isOpen(): boolean {
		return this.panel.hasClass('is-open');
	}

	open(): void {
		this.sync();
		this.panel.addClass('is-open');
		this.gear.setAttr('aria-expanded', 'true');
		const first = this.panel.querySelector('input, select, button');
		if (first instanceof HTMLElement) first.focus();
	}

	close(focusGear: boolean): void {
		if (!this.isOpen()) return;
		this.panel.removeClass('is-open');
		this.gear.setAttr('aria-expanded', 'false');
		if (focusGear) this.gear.focus();
	}

	toggle(): void {
		if (this.isOpen()) this.close(true);
		else this.open();
	}

	/** Brings every control in line with the store. */
	sync(): void {
		const vs: Readonly<ViewState> = this.store.viewState;
		for (const [key, t] of this.toggles) {
			if (t.getValue() !== vs[key]) t.setValue(vs[key]);
		}
		if (this.sort.getValue() !== vs.sort) this.sort.setValue(vs.sort);
		for (const [c, b] of this.columnButtons) {
			b.toggleClass('is-active', vs.columns === c);
			b.setAttr('aria-pressed', String(vs.columns === c));
		}
	}

	private row(label: string): HTMLElement {
		const row = this.panel.createDiv({ cls: 'lr-pop-row' });
		row.createSpan({ cls: 'lr-pop-label', text: label, attr: { id: `${this.uid}-${++this.rows}` } });
		return row;
	}

	/** Names a control after its row label; aria-label would add a hover tooltip. */
	private label(c: ToggleComponent | DropdownComponent, row: HTMLElement): void {
		const id = row.querySelector('.lr-pop-label')?.id ?? '';
		const el = c instanceof ToggleComponent ? c.toggleEl : c.selectEl;
		const target = el.querySelector('input') ?? el;
		target.setAttr('aria-labelledby', id);
	}
}

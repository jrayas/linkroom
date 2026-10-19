import { setTooltip } from 'obsidian';
import { shortenFolder } from '../core/paths';
import type { GroupKind, Item, Model, Section, ViewState } from '../core/types';
import { COPY } from './copy';

export interface RenderInput {
	model: Model;
	viewState: ViewState;
	folderChars: number;
	/** Prefix for element ids, unique per view. */
	idPrefix: string;
}

export interface RenderOutput {
	/** Rendered items in display order; the index is each element's `data-index`. */
	items: Item[];
	elements: HTMLElement[];
	/** Item count of each grid, in order, for keyboard navigation. */
	blocks: number[];
	status: string;
}

function showsFolder(item: Item, vs: ViewState): boolean {
	return item.folder !== '' && (vs.showFolders || item.needsFolder);
}

function renderItem(grid: HTMLElement, item: Item, index: number, input: RenderInput): HTMLElement {
	const cell = grid.createDiv({ cls: 'lr-cell', attr: { role: 'listitem' } });
	const el = cell.createDiv({ cls: 'lr-item', attr: { role: 'link', tabindex: '-1', 'data-index': String(index) } });
	const nameId = `${input.idPrefix}-${index}-n`;
	const labelled = [nameId];

	const line = el.createDiv({ cls: 'lr-line' });
	// The inner span is inline so the underline follows each wrapped line.
	line.createSpan({ cls: 'lr-name', attr: { id: nameId } }).createSpan({ cls: 'lr-name-text', text: item.name });
	if (input.viewState.showAliases && item.aliases.length > 0) {
		line.createSpan({ cls: 'lr-aliases', text: item.aliases.join(' · ') });
	}

	if (showsFolder(item, input.viewState)) {
		const short = shortenFolder(item.folder, input.folderChars);
		const folderId = `${input.idPrefix}-${index}-f`;
		const folder = el.createDiv({ cls: 'lr-folder', text: short.text, attr: { id: folderId } });
		if (short.offset > 0) setTooltip(folder, item.folder);
		labelled.push(folderId);
	}

	// aria-labelledby instead of aria-label: Obsidian turns aria-label into a hover tooltip.
	el.setAttr('aria-labelledby', labelled.join(' '));
	if (item.unresolved) {
		el.addClass('is-unresolved');
		el.setAttr('aria-disabled', 'true');
		setTooltip(el, COPY.unresolved);
	}
	return el;
}

function renderHeading(parent: HTMLElement, kind: GroupKind, count: number, id: string): void {
	const h = parent.createDiv({ cls: 'lr-heading', attr: { role: 'heading', 'aria-level': '2', id } });
	h.appendText(COPY.heading[kind]);
	h.createSpan({ cls: 'lr-heading-count', text: String(count) });
}

export function renderBody(body: HTMLElement, input: RenderInput): RenderOutput {
	const out: RenderOutput = { items: [], elements: [], blocks: [], status: '' };
	body.empty();
	const { model, viewState } = input;
	if (model.targetPath === null) return { ...out, status: COPY.noNote };
	if (model.sections.length === 0) return { ...out, status: COPY.allOff };
	if (model.sections.every((s) => s.items.length === 0)) return { ...out, status: COPY.noLinks };
	// "No outgoing links." would be untrue while Both ways lists notes, so one-way groups are then left out when empty (D-42).
	const bothHasNotes = model.sections.some((s) => s.kind === 'both' && s.items.length > 0);

	const frag = createFragment();
	// Grids are named by their heading (aria-labelledby); aria-label would show as a tooltip.
	const addGrid = (items: Item[], labelledBy: string | null): void => {
		const grid = frag.createDiv({ cls: labelledBy ? 'lr-grid' : 'lr-grid lr-grid-flat', attr: { role: 'list' } });
		if (labelledBy) grid.setAttr('aria-labelledby', labelledBy);
		for (const item of items) {
			out.elements.push(renderItem(grid, item, out.items.length, input));
			out.items.push(item);
		}
		out.blocks.push(items.length);
	};

	if (viewState.showHeadings) {
		for (const s of model.sections) {
			if (s.items.length === 0 && (s.kind === 'both' || bothHasNotes)) continue;
			const headingId = `${input.idPrefix}-h-${s.kind}`;
			renderHeading(frag.createDiv({ cls: 'lr-section' }), s.kind, s.items.length, headingId);
			if (s.items.length === 0) frag.createDiv({ cls: 'lr-section-empty', text: COPY.sectionEmpty[s.kind] });
			else addGrid(s.items, headingId);
		}
	} else {
		addGrid(model.sections.flatMap((s: Section) => s.items), null);
	}
	body.appendChild(frag);
	return out;
}

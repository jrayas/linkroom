import {
	ItemView, MarkdownView, Platform, Scope, setTooltip,
	TFile, type HoverParent, type HoverPopover, type TAbstractFile, type WorkspaceLeaf,
} from 'obsidian';
import { debounce, type Debounced, type Timers } from '../core/debounce';
import { isNavKey, nextIndex } from '../core/grid-nav';
import { buildModel } from '../core/model';
import type { Item, Model } from '../core/types';
import { triggerHover } from '../obsidian/hover';
import { showItemMenu } from '../obsidian/menu';
import { modeFromEvent, openInBackground, openNote, type OpenMode } from '../obsidian/open';
import { takeSnapshot } from '../obsidian/snapshot';
import { fallbackTarget, findMarkdownLeaf, isLiveMarkdownLeaf } from '../obsidian/target';
import type { ChangeKind, Store } from '../store';
import { COPY } from './copy';
import { applyAppearance, updateContrast } from './css-vars';
import { RovingFocus } from './keyboard';
import { Popover } from './popover';
import { ItemPress } from './press';
import { renderBody } from './render';
import { SearchBox } from './search';

export const VIEW_TYPE = 'linkroom';

let viewCount = 0;

interface Els {
	root: HTMLElement;
	title: HTMLElement;
	status: HTMLElement;
	body: HTMLElement;
}

export class LinkroomView extends ItemView implements HoverParent {
	hoverPopover: HoverPopover | null = null;

	private els: Els | null = null;
	private search: SearchBox | null = null;
	private popover: Popover | null = null;
	private press: ItemPress | null = null;
	private roving = new RovingFocus();
	private target: TFile | null = null;
	private lastMarkdownLeaf: WorkspaceLeaf | null = null;
	private model: Model | null = null;
	private stale = false;
	private items: Item[] = [];
	private itemEls: HTMLElement[] = [];
	private blocks: number[] = [];
	private folderChars = 60;
	private idPrefix = `lr-${++viewCount}`;
	private timers: Timers = {
		set: (fn, ms) => window.setTimeout(fn, ms),
		clear: (id) => window.clearTimeout(id),
	};
	private refreshSoon: Debounced = debounce(() => this.refresh(false), 150, this.timers);
	private resizeSoon: Debounced = debounce(() => this.afterResize(), 100, this.timers);

	// Kept cheap on purpose: views can be created long before they are shown.
	constructor(leaf: WorkspaceLeaf, private store: Store, private lastLeafSeen: () => WorkspaceLeaf | null) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return COPY.tabTitle;
	}

	getIcon(): string {
		return 'link-2';
	}

	onOpen(): Promise<void> {
		this.buildShell();
		this.registerEvents();
		const seen = this.lastLeafSeen();
		this.target = fallbackTarget(this.app, seen);
		this.lastMarkdownLeaf = isLiveMarkdownLeaf(this.app, seen) ? seen : findMarkdownLeaf(this.app, this.target);
		this.applyAppearance();
		this.refresh(true);
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.refreshSoon.cancel();
		this.resizeSoon.cancel();
		this.press?.cancel();
		this.els = null;
		this.search = null;
		this.popover = null;
		this.press = null;
		return Promise.resolve();
	}

	/** Called by Obsidian when the tab changes size. */
	onResize(): void {
		this.resizeSoon.call();
	}

	// ---- building -------------------------------------------------------

	private buildShell(): void {
		this.contentEl.empty();
		this.contentEl.addClass('lr-view-content');
		// No aria-label on containers: Obsidian shows every aria-label as a hover tooltip.
		const root = this.contentEl.createDiv({ cls: 'lr-root' });

		this.popover = new Popover(root.createDiv({ cls: 'lr-gear-wrap' }), this, this.store);

		const content = root.createDiv({ cls: 'lr-content' });
		this.search = new SearchBox(content, this, this.app, `${this.idPrefix}-search`, (file, evt) => this.showNote(file, evt));

		const title = content.createDiv({ cls: 'lr-title', attr: { role: 'heading', 'aria-level': '1' } });

		const status = content.createDiv({ cls: 'lr-status', attr: { 'aria-live': 'polite' } });
		const body = content.createDiv({ cls: 'lr-body' });

		// Hidden colour probes: computed `color` is always rgb(), whatever the theme wrote.
		root.createSpan({ cls: 'lr-probe lr-probe-link', attr: { 'aria-hidden': 'true' } });
		root.createSpan({ cls: 'lr-probe lr-probe-bg', attr: { 'aria-hidden': 'true' } });

		this.els = { root, title, status, body };

		this.scope = new Scope(this.app.scope);
		this.scope.register(['Mod'], 'f', () => {
			this.search?.focus();
			return false;
		});
	}

	private registerEvents(): void {
		const els = this.els;
		if (!els) return;
		const { workspace, metadataCache, vault } = this.app;

		this.registerEvent(workspace.on('active-leaf-change', (leaf) => this.onActiveLeaf(leaf)));
		this.registerEvent(workspace.on('file-open', (file) => this.onFileOpen(file)));
		this.registerEvent(workspace.on('layout-change', () => this.refreshIfStale()));
		this.registerEvent(workspace.on('css-change', () => {
			if (this.els) updateContrast(this.els.root);
		}));
		this.registerEvent(metadataCache.on('resolved', () => this.refreshSoon.call()));
		this.registerEvent(metadataCache.on('changed', () => this.refreshSoon.call()));
		this.registerEvent(metadataCache.on('deleted', () => this.refreshSoon.call()));
		this.registerEvent(vault.on('rename', () => this.refreshSoon.call()));
		this.registerEvent(vault.on('delete', (file) => this.onDelete(file)));
		this.register(this.store.subscribe((kind) => this.onStoreChange(kind)));

		this.press = new ItemPress(this, els.body, {
			itemAt: (e) => this.itemFromEvent(e),
			showMenu: (i, at) => {
				const file = this.fileAt(i);
				if (!file) return false;
				showItemMenu(at, this.app, file, (mode) => this.activate(i, mode));
				return true;
			},
			click: (e, i) => {
				this.roving.set(i);
				this.activate(i, modeFromEvent(e));
			},
		});
		this.registerDomEvent(els.body, 'auxclick', (e) => {
			const i = this.itemFromEvent(e);
			if (e.button === 1 && i !== null) this.activate(i, 'tab');
		});
		// Stops the browser's middle-click autoscroll so auxclick can open a tab.
		this.registerDomEvent(els.body, 'mousedown', (e) => {
			if (e.button === 1 && this.itemFromEvent(e) !== null) e.preventDefault();
		});
		this.registerDomEvent(els.body, 'mouseover', (e) => this.onMouseOver(e));
		this.registerDomEvent(els.body, 'focusin', (e) => {
			const i = this.itemFromEvent(e);
			if (i !== null) this.roving.set(i);
		});
		this.registerDomEvent(els.root, 'keydown', (e) => this.onRootKey(e));
	}

	// ---- following the active note ---------------------------------------

	private onActiveLeaf(leaf: WorkspaceLeaf | null): void {
		if (leaf && leaf.view instanceof MarkdownView) {
			this.lastMarkdownLeaf = leaf;
			if (leaf.view.file) this.setTarget(leaf.view.file);
		}
		this.refreshIfStale();
	}

	private onFileOpen(file: TFile | null): void {
		if (!file || file.extension !== 'md') return;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.file === file) {
			this.lastMarkdownLeaf = view.leaf;
			this.setTarget(file);
		}
	}

	private onDelete(file: TAbstractFile): void {
		if (file === this.target) {
			this.target = null;
			this.setTarget(fallbackTarget(this.app, this.lastMarkdownLeaf, file instanceof TFile ? file : null));
		}
		this.refreshSoon.call();
	}

	private setTarget(file: TFile | null): void {
		if (file === this.target) return;
		this.target = file;
		this.refresh(true);
	}

	/**
	 * A note chosen in search (D-44): opened like the quick switcher, but behind
	 * this tab, and shown here straight away. No leaf change follows, so retarget directly.
	 */
	private showNote(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.setTarget(file);
		this.els?.root.scrollTo({ top: 0 });
		void openInBackground(this.app, file, modeFromEvent(evt) !== false, this.lastMarkdownLeaf).then(() => {
			// A new tab becomes active as soon as it is created; bring this page back to the front.
			if (this.app.workspace.getMostRecentLeaf() !== this.leaf) this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
			this.setTarget(file);
		});
	}

	// ---- refresh and render ------------------------------------------------

	private isVisible(): boolean {
		return this.els !== null && this.els.root.isShown();
	}

	private refreshIfStale(): void {
		if (this.stale && this.isVisible()) this.refresh(true);
	}

	private refresh(force: boolean): void {
		if (!this.els) return;
		if (!this.isVisible()) {
			// Hidden tabs do no work; they catch up when shown (D-20).
			this.stale = true;
			return;
		}
		this.stale = false;
		const s = this.store.settings;
		const model = buildModel(takeSnapshot(this.app, this.target), this.store.viewState, {
			hideUnresolved: s.unresolvedLinks === 'hidden',
			duplicateFolders: s.duplicateFolders,
		});
		if (!force && this.model && this.model.signature === model.signature) return;
		this.model = model;
		this.updateTitle();
		this.renderResults();
	}

	private updateTitle(): void {
		if (!this.els) return;
		const name = this.model?.targetName ?? '';
		this.els.title.setText(name);
		this.els.title.toggleClass('lr-hidden', name === '');
	}

	/** Re-renders the body from the current model and query, keeping scroll and focus. */
	private renderResults(): void {
		const els = this.els;
		const model = this.model;
		if (!els || !model) return;
		const scrollTop = els.root.scrollTop;
		const hadFocus = els.body.contains(els.body.doc.activeElement);
		const focusedKey = this.items[this.roving.index]?.key;

		const out = renderBody(els.body, {
			model, viewState: this.store.viewState, folderChars: this.folderChars, idPrefix: this.idPrefix,
		});
		this.items = out.items;
		this.itemEls = out.elements;
		this.blocks = out.blocks;
		els.status.setText(out.status);
		els.status.toggleClass('lr-hidden', out.status === '');

		const kept = focusedKey === undefined ? -1 : this.items.findIndex((it) => it.key === focusedKey);
		this.roving.reset(this.itemEls, Math.max(0, kept));
		if (hadFocus && kept !== -1) this.itemEls[kept]?.focus();
		els.root.scrollTop = scrollTop;

		if (this.measureFolderChars()) this.renderResults();
		else this.markTruncated();
	}

	/**
	 * Gives cut-off names a tooltip with the full name (FR-44). One pass after
	 * layout: all reads, then all writes, so the browser lays out only once.
	 */
	private markTruncated(): void {
		const cut = this.itemEls.map((el) => {
			const name = el.querySelector('.lr-name');
			return name instanceof HTMLElement && (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1) ? name : null;
		});
		cut.forEach((name, i) => {
			if (name) setTooltip(name, this.items[i]?.name ?? '');
		});
	}

	/** Estimates how many folder characters fit in a column (D-16). True if it changed and folders are shown. */
	private measureFolderChars(): boolean {
		const els = this.els;
		if (!els) return false;
		const cell = els.body.querySelector('.lr-cell');
		const width = cell instanceof HTMLElement ? cell.clientWidth : els.body.clientWidth;
		if (width <= 0) return false;
		const folder = els.body.querySelector('.lr-folder');
		const px = parseFloat(els.root.win.getComputedStyle(folder instanceof HTMLElement ? folder : els.root).fontSize) || 13;
		const chars = Math.max(8, Math.floor(width / (px * 0.55)));
		if (chars === this.folderChars) return false;
		this.folderChars = chars;
		return folder !== null;
	}

	private afterResize(): void {
		if (this.stale) {
			this.refreshIfStale();
			return;
		}
		if (this.measureFolderChars()) this.renderResults();
		else this.markTruncated();
	}

	private applyAppearance(): void {
		if (this.els) applyAppearance(this.els.root, this.store.settings, this.store.viewState);
	}

	private onStoreChange(kind: ChangeKind): void {
		this.applyAppearance();
		if (kind === 'viewState') this.popover?.sync();
		this.refresh(true);
	}

	// ---- items ------------------------------------------------------------------

	private itemFromEvent(e: Event): number | null {
		if (!(e.target instanceof Element)) return null;
		const el = e.target.closest('.lr-item');
		if (!(el instanceof HTMLElement)) return null;
		const i = Number(el.dataset.index);
		return Number.isInteger(i) && this.items[i] ? i : null;
	}

	private fileAt(index: number): TFile | null {
		const it = this.items[index];
		if (!it || it.unresolved || it.path === null) return null;
		return this.app.vault.getFileByPath(it.path);
	}

	private activate(index: number, mode: OpenMode): void {
		const file = this.fileAt(index);
		if (file) void openNote(this.app, file, mode, this.lastMarkdownLeaf);
	}

	private onMouseOver(e: MouseEvent): void {
		if (Platform.isMobile) return;
		const i = this.itemFromEvent(e);
		if (i === null) return;
		const el = this.itemEls[i];
		if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
		const file = this.fileAt(i);
		if (!file || !this.target) return;
		triggerHover(this.app, { event: e, hoverParent: this, targetEl: el, linktext: file.path, sourcePath: this.target.path });
	}

	// ---- keyboard ------------------------------------------------------------------

	private columnsNow(): number {
		const grid = this.els?.body.querySelector('.lr-grid');
		if (!(grid instanceof HTMLElement)) return 1;
		const cols = grid.win.getComputedStyle(grid).gridTemplateColumns.split(' ').filter((c) => c !== '').length;
		return Math.max(1, cols);
	}

	private onRootKey(e: KeyboardEvent): void {
		const target = e.target;
		const inField = target instanceof HTMLElement
			&& (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

		if (e.key === 'Escape' && this.popover?.isOpen()) {
			e.preventDefault();
			this.popover.close(true);
			return;
		}
		if (e.key === '/' && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			this.search?.focus();
			return;
		}
		const i = this.itemFromEvent(e);
		if (i === null) return;
		if (e.key === 'Enter') {
			e.preventDefault();
			this.activate(i, modeFromEvent(e));
		} else if (isNavKey(e.key)) {
			e.preventDefault();
			const next = nextIndex(this.blocks, this.columnsNow(), i, e.key);
			if (next >= 0) this.roving.focus(next);
		}
	}
}

import { MarkdownView, Plugin, type WorkspaceLeaf } from 'obsidian';
import { HOVER_SOURCE } from './obsidian/hover';
import { LinkroomSettingTab } from './settings/tab';
import { Store } from './store';
import { COPY } from './view/copy';
import { LinkroomView, VIEW_TYPE } from './view/LinkroomView';

export default class LinkroomPlugin extends Plugin {
	store!: Store;
	/** Last focused markdown tab. A leaf, not a view, so no view reference is kept here. */
	private lastMarkdownLeaf: WorkspaceLeaf | null = null;

	async onload(): Promise<void> {
		this.store = new Store(
			() => this.loadData(),
			(data) => this.saveData(data),
			{ set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
		);
		await this.store.load();

		this.registerView(VIEW_TYPE, (leaf) => new LinkroomView(leaf, this.store, () => this.lastMarkdownLeaf));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view instanceof MarkdownView) this.lastMarkdownLeaf = leaf;
		}));
		// Opening a file in the tab that is already active fires no leaf change.
		this.registerEvent(this.app.workspace.on('file-open', () => {
			const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
			if (leaf) this.lastMarkdownLeaf = leaf;
		}));
		this.addRibbonIcon('link-2', COPY.command, () => void this.openView());
		this.addCommand({ id: 'open', name: COPY.command, callback: () => void this.openView() });
		this.registerHoverLinkSource(HOVER_SOURCE, { display: COPY.tabTitle, defaultMod: true });
		this.addSettingTab(new LinkroomSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.lastMarkdownLeaf ??= this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf ?? null;
			if (this.store.settings.openOnStartup && this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
				void this.openView();
			}
		});
	}

	onunload(): void {
		this.store.flush();
	}

	async onExternalSettingsChange(): Promise<void> {
		await this.store.load();
	}

	/** One Linkroom tab at most: focus it if it exists, otherwise open a new tab (FR-04). */
	private async openView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (existing) {
			await workspace.revealLeaf(existing);
			workspace.setActiveLeaf(existing, { focus: true });
			return;
		}
		const leaf = workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		await workspace.revealLeaf(leaf);
	}
}

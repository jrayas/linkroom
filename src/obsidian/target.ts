import { MarkdownView, type App, type TFile, type WorkspaceLeaf } from 'obsidian';

export function activeMarkdownFile(app: App): TFile | null {
	return app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
}

export function leafFile(leaf: WorkspaceLeaf | null): TFile | null {
	return leaf?.view instanceof MarkdownView ? leaf.view.file : null;
}

/**
 * The note to show when nothing better is known: the active note, else the last
 * markdown tab the plugin saw, else the most recently opened file, else any open note.
 * The Linkroom tab is usually active itself when this runs, hence the chain.
 * `exclude` is a file being deleted: the delete event fires before its tab
 * empties, so the tab would otherwise hand the deleted note straight back.
 */
export function fallbackTarget(app: App, lastLeaf: WorkspaceLeaf | null, exclude: TFile | null = null): TFile | null {
	const usable = (f: TFile | null): f is TFile => f !== null && f !== exclude && f.extension === 'md' && app.vault.getFileByPath(f.path) === f;
	const candidates = [activeMarkdownFile(app), isLiveMarkdownLeaf(app, lastLeaf) ? leafFile(lastLeaf) : null];
	for (const path of app.workspace.getLastOpenFiles()) candidates.push(app.vault.getFileByPath(path));
	for (const leaf of app.workspace.getLeavesOfType('markdown')) candidates.push(leafFile(leaf));
	return candidates.find(usable) ?? null;
}

/** A markdown leaf to open notes in, preferring the one showing `file`. */
export function findMarkdownLeaf(app: App, file: TFile | null): WorkspaceLeaf | null {
	const leaves = app.workspace.getLeavesOfType('markdown');
	return leaves.find((l) => l.view instanceof MarkdownView && l.view.file === file) ?? leaves[0] ?? null;
}

export function isLiveMarkdownLeaf(app: App, leaf: WorkspaceLeaf | null): leaf is WorkspaceLeaf {
	return leaf !== null && app.workspace.getLeavesOfType('markdown').includes(leaf);
}

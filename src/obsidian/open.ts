import { Keymap, Platform, type App, type PaneType, type TFile, type UserEvent, type WorkspaceLeaf } from 'obsidian';
import { isLiveMarkdownLeaf } from './target';

/** `false` means a plain click: open in the last markdown tab (D-07). */
export type OpenMode = false | PaneType;

function forPlatform(mode: PaneType): PaneType {
	// Phones and tablets have no pop-out windows, and phones no splits (D-14).
	return Platform.isMobile && mode !== 'tab' ? 'tab' : mode;
}

export function modeFromEvent(evt: UserEvent): OpenMode {
	const m = Keymap.isModEvent(evt);
	if (m === false) return false;
	return forPlatform(m === true ? 'tab' : m);
}

export async function openNote(app: App, file: TFile, mode: OpenMode, lastLeaf: WorkspaceLeaf | null): Promise<void> {
	if (mode === false) {
		// Never replace the Linkroom tab itself: reuse the last markdown tab, else a new one.
		const leaf = isLiveMarkdownLeaf(app, lastLeaf) ? lastLeaf : app.workspace.getLeaf('tab');
		await leaf.openFile(file, { active: true });
		return;
	}
	await app.workspace.getLeaf(forPlatform(mode)).openFile(file, { active: true });
}

/**
 * Search choice (D-44): open the note like the quick switcher but behind the
 * Linkroom tab, so the page stays in front and visibly switches to the note.
 */
export async function openInBackground(app: App, file: TFile, newTab: boolean, lastLeaf: WorkspaceLeaf | null): Promise<void> {
	const leaf = !newTab && isLiveMarkdownLeaf(app, lastLeaf) ? lastLeaf : app.workspace.getLeaf('tab');
	await leaf.openFile(file, { active: false });
}

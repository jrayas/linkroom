import { Menu, Platform, type App, type TFile } from 'obsidian';
import type { OpenMode } from './open';
import { canReveal, revealFile } from './reveal';

/** Read-only menu: no `file-menu` event, so other plugins cannot add edit actions. */
export function showItemMenu(at: MouseEvent | { x: number; y: number }, app: App, file: TFile, open: (mode: OpenMode) => void): void {
	const menu = new Menu();
	menu.addItem((i) => i.setTitle('Open').setIcon('file').onClick(() => open(false)));
	menu.addItem((i) => i.setTitle('Open in new tab').setIcon('file-plus').onClick(() => open('tab')));
	// On phones a split is just another tab, so the item would duplicate the one above.
	if (!Platform.isPhone) {
		menu.addItem((i) => i.setTitle('Open to the right').setIcon('separator-vertical').onClick(() => open('split')));
	}
	if (!Platform.isPhone && canReveal(app)) {
		menu.addItem((i) => i.setTitle('Reveal in file explorer').setIcon('folder-open').onClick(() => revealFile(app, file)));
	}
	if (at instanceof MouseEvent) menu.showAtMouseEvent(at);
	else menu.showAtPosition(at);
}

import type { App, TFile } from 'obsidian';

interface FileExplorerLike {
	revealInFolder(file: TFile): void;
}

interface InternalPluginsLike {
	getEnabledPluginById?(id: string): unknown;
}

/**
 * The core File explorer has no public API for revealing a file (D-08). This is
 * the plugin's only use of an internal, so it is feature-detected and never throws.
 */
function getExplorer(app: App): FileExplorerLike | null {
	try {
		const internal = (app as unknown as { internalPlugins?: InternalPluginsLike }).internalPlugins;
		const plugin = internal?.getEnabledPluginById?.('file-explorer') as Partial<FileExplorerLike> | null | undefined;
		return plugin && typeof plugin.revealInFolder === 'function' ? (plugin as FileExplorerLike) : null;
	} catch {
		return null;
	}
}

export function canReveal(app: App): boolean {
	return getExplorer(app) !== null;
}

export function revealFile(app: App, file: TFile): void {
	try {
		getExplorer(app)?.revealInFolder(file);
	} catch (e) {
		console.warn('Linkroom: could not reveal file', e);
	}
}

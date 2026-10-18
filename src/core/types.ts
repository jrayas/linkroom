export type GroupKind = 'both' | 'outgoing' | 'backlinks';
export type LinkStyle = 'hairline' | 'apple' | 'tile';
export type SortMode = 'az' | 'za' | 'modified' | 'appearance';
export type Columns = '1' | '2' | '3' | '4' | 'auto';

export interface ViewState {
	showFolders: boolean;
	showHeadings: boolean;
	showAliases: boolean;
	showBoth: boolean;
	showOutgoing: boolean;
	showBacklinks: boolean;
	sort: SortMode;
	columns: Columns;
}

export interface ViewDefaults {
	columns: Columns;
	sort: SortMode;
	showFolders: boolean;
	showHeadings: boolean;
	showAliases: boolean;
}

export interface Settings {
	fontFamily: 'interface' | 'text' | 'system' | 'custom';
	customFontFamily: string;
	fontSize: 'small' | 'medium' | 'large';
	linkStyle: LinkStyle;
	linkColourMode: 'theme' | 'custom';
	customLinkColour: string;
	underlineThickness: 'thin' | 'regular';
	rowSpacing: 'compact' | 'comfortable' | 'spacious';
	folderPathStyle: 'dimmed' | 'same';
	wrapLongNames: boolean;
	maxWrapLines: 2 | 3;
	unresolvedLinks: 'dimmed' | 'hidden';
	duplicateFolders: 'auto' | 'never';
	openOnStartup: boolean;
	startWith: 'remembered' | 'defaults';
	defaults: ViewDefaults;
}

export interface StoredData {
	schemaVersion: number;
	settings: Settings;
	viewState: ViewState;
}

/** One link as read from Obsidian, before any filtering. */
export interface RawLink {
	/** Vault path of the linked file; null when the link is unresolved. */
	path: string | null;
	/** The link path as written, used for unresolved links. */
	linkText: string;
	name: string;
	folder: string;
	aliases: string[];
	mtime: number;
	/** Character offset of the first occurrence in the target; null for backlinks. */
	firstOffset: number | null;
}

export interface LinkSnapshot {
	target: { path: string; name: string } | null;
	outgoing: RawLink[];
	backlinks: RawLink[];
}

export interface Item {
	key: string;
	group: GroupKind;
	path: string | null;
	name: string;
	folder: string;
	aliases: string[];
	mtime: number;
	firstOffset: number | null;
	unresolved: boolean;
	needsFolder: boolean;
}

export interface Section {
	kind: GroupKind;
	items: Item[];
}

export interface Model {
	targetPath: string | null;
	targetName: string;
	sections: Section[];
	signature: string;
}

export type Range = [start: number, end: number];

import type { Columns, LinkStyle, Settings, SortMode, StoredData, ViewDefaults, ViewState } from './types';

export const SCHEMA_VERSION = 2;

export const DEFAULT_VIEW_DEFAULTS: ViewDefaults = {
	columns: '2',
	sort: 'az',
	showFolders: false,
	showHeadings: true,
	showAliases: false,
};

export const DEFAULT_SETTINGS: Settings = {
	fontFamily: 'interface',
	customFontFamily: '',
	fontSize: 'medium',
	linkStyle: 'hairline',
	linkColourMode: 'theme',
	customLinkColour: '',
	underlineThickness: 'thin',
	rowSpacing: 'comfortable',
	folderPathStyle: 'dimmed',
	wrapLongNames: false,
	maxWrapLines: 2,
	unresolvedLinks: 'dimmed',
	duplicateFolders: 'auto',
	openOnStartup: false,
	startWith: 'remembered',
	defaults: { ...DEFAULT_VIEW_DEFAULTS },
};

export function viewStateFromDefaults(d: ViewDefaults): ViewState {
	return {
		showFolders: d.showFolders,
		showHeadings: d.showHeadings,
		showAliases: d.showAliases,
		showBoth: true,
		showOutgoing: true,
		showBacklinks: true,
		sort: d.sort,
		columns: d.columns,
	};
}

export const DEFAULT_VIEW_STATE: ViewState = viewStateFromDefaults(DEFAULT_VIEW_DEFAULTS);

export const SORT_MODES: readonly SortMode[] = ['az', 'za', 'modified', 'appearance'];
export const COLUMN_OPTIONS: readonly Columns[] = ['1', '2', '3', '4', 'auto'];
export const LINK_STYLES: readonly LinkStyle[] = ['hairline', 'apple', 'tile'];

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T>(v: unknown, allowed: readonly T[], fallback: T): T {
	return allowed.includes(v as T) ? (v as T) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, fallback: string, max = 200): string {
	return typeof v === 'string' ? v.slice(0, max) : fallback;
}

export function isHexColour(v: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(v);
}

function validateDefaults(raw: unknown): ViewDefaults {
	const r = isRec(raw) ? raw : {};
	const d = DEFAULT_VIEW_DEFAULTS;
	return {
		columns: oneOf(r.columns, COLUMN_OPTIONS, d.columns),
		sort: oneOf(r.sort, SORT_MODES, d.sort),
		showFolders: bool(r.showFolders, d.showFolders),
		showHeadings: bool(r.showHeadings, d.showHeadings),
		showAliases: bool(r.showAliases, d.showAliases),
	};
}

export function validateSettings(raw: unknown): Settings {
	const r = isRec(raw) ? raw : {};
	const d = DEFAULT_SETTINGS;
	const colour = str(r.customLinkColour, d.customLinkColour, 7);
	return {
		fontFamily: oneOf(r.fontFamily, ['interface', 'text', 'system', 'custom'] as const, d.fontFamily),
		customFontFamily: str(r.customFontFamily, d.customFontFamily),
		fontSize: oneOf(r.fontSize, ['small', 'medium', 'large'] as const, d.fontSize),
		linkStyle: oneOf(r.linkStyle, LINK_STYLES, d.linkStyle),
		linkColourMode: oneOf(r.linkColourMode, ['theme', 'custom'] as const, d.linkColourMode),
		customLinkColour: isHexColour(colour) ? colour.toLowerCase() : '',
		underlineThickness: oneOf(r.underlineThickness, ['thin', 'regular'] as const, d.underlineThickness),
		rowSpacing: oneOf(r.rowSpacing, ['compact', 'comfortable', 'spacious'] as const, d.rowSpacing),
		folderPathStyle: oneOf(r.folderPathStyle, ['dimmed', 'same'] as const, d.folderPathStyle),
		wrapLongNames: bool(r.wrapLongNames, d.wrapLongNames),
		maxWrapLines: oneOf(r.maxWrapLines, [2, 3] as const, d.maxWrapLines),
		unresolvedLinks: oneOf(r.unresolvedLinks, ['dimmed', 'hidden'] as const, d.unresolvedLinks),
		duplicateFolders: oneOf(r.duplicateFolders, ['auto', 'never'] as const, d.duplicateFolders),
		openOnStartup: bool(r.openOnStartup, d.openOnStartup),
		startWith: oneOf(r.startWith, ['remembered', 'defaults'] as const, d.startWith),
		defaults: validateDefaults(r.defaults),
	};
}

export function validateViewState(raw: unknown): ViewState {
	const r = isRec(raw) ? raw : {};
	const d = DEFAULT_VIEW_STATE;
	return {
		showFolders: bool(r.showFolders, d.showFolders),
		showHeadings: bool(r.showHeadings, d.showHeadings),
		showAliases: bool(r.showAliases, d.showAliases),
		showBoth: bool(r.showBoth, d.showBoth),
		showOutgoing: bool(r.showOutgoing, d.showOutgoing),
		showBacklinks: bool(r.showBacklinks, d.showBacklinks),
		sort: oneOf(r.sort, SORT_MODES, d.sort),
		columns: oneOf(r.columns, COLUMN_OPTIONS, d.columns),
	};
}

/** Upgrades older shapes to the current one. Version 0 means "no schemaVersion". */
export function migrate(raw: unknown): Rec {
	const r = isRec(raw) ? { ...raw } : {};
	const version = typeof r.schemaVersion === 'number' ? r.schemaVersion : 0;
	if (version < 2 && isRec(r.settings)) {
		// Version 2 (D-47): the underline colour became the link colour; keepSearch went with the old filter.
		const s: Rec = { ...r.settings };
		if (s.linkColourMode === undefined) s.linkColourMode = s.underlineColourMode;
		if (s.customLinkColour === undefined) s.customLinkColour = s.customUnderlineColour;
		delete s.underlineColourMode;
		delete s.customUnderlineColour;
		delete s.keepSearch;
		r.settings = s;
	}
	r.schemaVersion = SCHEMA_VERSION;
	return r;
}

/**
 * Turns whatever is in data.json into valid data. `atStartup` applies the
 * "Start with: Defaults" rule, which only matters when Obsidian launches.
 */
export function loadData(raw: unknown, atStartup: boolean): StoredData {
	const r = migrate(raw);
	const settings = validateSettings(r.settings);
	const viewState = atStartup && settings.startWith === 'defaults'
		? viewStateFromDefaults(settings.defaults)
		: validateViewState(r.viewState);
	return { schemaVersion: SCHEMA_VERSION, settings, viewState };
}

export function defaultData(): StoredData {
	return {
		schemaVersion: SCHEMA_VERSION,
		settings: { ...DEFAULT_SETTINGS, defaults: { ...DEFAULT_VIEW_DEFAULTS } },
		viewState: { ...DEFAULT_VIEW_STATE },
	};
}

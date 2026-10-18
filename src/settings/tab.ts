import { PluginSettingTab, type App, type Setting, type SettingDefinitionItem } from 'obsidian';
import { parseColour, toHex } from '../core/contrast';
import { COLUMN_OPTIONS, SORT_MODES } from '../core/settings';
import type { Settings, ViewDefaults } from '../core/types';
import type LinkroomPlugin from '../main';
import type { Store } from '../store';
import { COPY } from '../view/copy';
import { resolvedAccentHex } from '../view/css-vars';

const FALLBACK_ACCENT = '#7c6bf2';
const RESET_CONFIRM_MS = 4000;

const COLUMN_LABELS: Record<string, string> = { '1': '1', '2': '2', '3': '3', '4': '4', auto: 'Auto' };
const SORT_LABELS: Record<string, string> = Object.fromEntries(SORT_MODES.map((m) => [m, COPY.sort[m]]));
const COLUMN_CHOICES: Record<string, string> = Object.fromEntries(COLUMN_OPTIONS.map((c) => [c, COLUMN_LABELS[c] ?? c]));

/** Declarative settings page (D-02). Values are read and written through the store, not plugin.settings. */
export class LinkroomSettingTab extends PluginSettingTab {
	private store: Store;
	/** Set while this tab is writing, so its own change does not rebuild it mid-edit. */
	private writing = false;

	constructor(app: App, plugin: LinkroomPlugin) {
		super(app, plugin);
		this.store = plugin.store;
		plugin.register(this.store.subscribe((kind) => {
			if (kind === 'settings' && !this.writing && this.containerEl.isShown()) this.update();
		}));
	}

	getControlValue(key: string): unknown {
		const s = this.store.settings;
		if (key.startsWith('defaults.')) return s.defaults[key.slice('defaults.'.length) as keyof ViewDefaults];
		if (key === 'maxWrapLines') return String(s.maxWrapLines);
		return s[key as keyof Settings];
	}

	setControlValue(key: string, value: unknown): void {
		this.writing = true;
		let rebuild = false;
		try {
			if (key.startsWith('defaults.')) {
				this.store.updateDefaults({ [key.slice('defaults.'.length)]: value });
			} else if (key === 'maxWrapLines') {
				this.store.updateSettings({ maxWrapLines: Number(value) as 2 | 3 });
			} else if (key === 'linkColourMode' && value === 'custom' && this.store.settings.customLinkColour === '') {
				// Pre-fill with the current accent so switching to Custom changes nothing visible.
				const accent = resolvedAccentHex(this.containerEl.doc, (c) => {
					const rgb = parseColour(c);
					return rgb ? toHex(rgb) : null;
				});
				this.store.updateSettings({ linkColourMode: 'custom', customLinkColour: accent ?? FALLBACK_ACCENT });
				rebuild = true;
			} else {
				this.store.updateSettings({ [key]: value });
			}
		} finally {
			this.writing = false;
		}
		if (rebuild) this.update();
		else this.refreshDomState();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const s = (): Readonly<Settings> => this.store.settings;
		return [
			{
				type: 'group',
				heading: 'Appearance',
				items: [
					{
						name: 'Font family',
						control: {
							type: 'dropdown', key: 'fontFamily',
							options: { interface: 'Theme interface font', text: 'Theme text font', system: 'System', custom: 'Custom' },
						},
					},
					{
						name: 'Custom font family',
						desc: 'Any CSS font-family value, for example "Inter", sans-serif.',
						visible: () => s().fontFamily === 'custom',
						control: { type: 'text', key: 'customFontFamily', placeholder: 'Inter, sans-serif' },
					},
					{
						name: 'Font size',
						control: { type: 'dropdown', key: 'fontSize', options: { small: 'Small', medium: 'Medium', large: 'Large' } },
					},
					{
						name: 'Link style',
						desc: 'How note names look and respond to the pointer.',
						control: { type: 'dropdown', key: 'linkStyle', options: COPY.linkStyle },
					},
					{
						name: 'Link colour',
						control: { type: 'dropdown', key: 'linkColourMode', options: { theme: 'Theme accent', custom: 'Custom' } },
					},
					{
						name: 'Custom link colour',
						visible: () => s().linkColourMode === 'custom',
						control: { type: 'color', key: 'customLinkColour' },
					},
					{
						name: 'Underline thickness',
						visible: () => s().linkStyle === 'hairline',
						control: { type: 'dropdown', key: 'underlineThickness', options: { thin: 'Thin', regular: 'Regular' } },
					},
					{
						name: 'Row spacing',
						control: {
							type: 'dropdown', key: 'rowSpacing',
							options: { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
						},
					},
					{
						name: 'Folder path style',
						control: { type: 'dropdown', key: 'folderPathStyle', options: { dimmed: 'Dimmed', same: 'Same as name' } },
					},
					{
						name: 'Wrap long names',
						desc: 'Let long names use more than one line instead of ending in an ellipsis.',
						control: { type: 'toggle', key: 'wrapLongNames' },
					},
					{
						name: 'Maximum lines when wrapping',
						visible: () => s().wrapLongNames,
						control: { type: 'dropdown', key: 'maxWrapLines', options: { '2': '2', '3': '3' } },
					},
				],
			},
			{
				type: 'group',
				heading: 'Behaviour',
				items: [
					{
						name: 'Unresolved links',
						desc: 'Links to notes that do not exist yet.',
						control: { type: 'dropdown', key: 'unresolvedLinks', options: { dimmed: 'Dimmed', hidden: 'Hidden' } },
					},
					{
						name: 'Show folder for duplicate names',
						desc: 'When two notes share a name, show their folders even if folders are off.',
						control: { type: 'dropdown', key: 'duplicateFolders', options: { auto: 'Automatically', never: 'Never' } },
					},
					{
						name: 'Open on startup',
						control: { type: 'toggle', key: 'openOnStartup' },
					},
					{
						name: 'Start with',
						desc: 'What the view options are when Obsidian starts.',
						control: { type: 'dropdown', key: 'startWith', options: { remembered: 'Remembered choices', defaults: 'Defaults' } },
					},
					{
						name: 'Default columns',
						control: { type: 'dropdown', key: 'defaults.columns', options: COLUMN_CHOICES },
					},
					{
						name: 'Default sort',
						control: { type: 'dropdown', key: 'defaults.sort', options: SORT_LABELS },
					},
					{ name: 'Default show folders', control: { type: 'toggle', key: 'defaults.showFolders' } },
					{ name: 'Default show headings', control: { type: 'toggle', key: 'defaults.showHeadings' } },
					{ name: 'Default show aliases', control: { type: 'toggle', key: 'defaults.showAliases' } },
				],
			},
			{
				type: 'group',
				heading: 'Shortcuts and reset',
				items: [
					{ name: 'Hotkey', desc: 'Set a hotkey for open linked notes in the hotkeys settings.' },
					{
						name: 'Reset all settings',
						desc: 'Restore every option, including the view options, to its default.',
						render: (setting) => this.renderReset(setting),
					},
				],
			},
		];
	}

	/** Two-step button: the first press arms it for a few seconds, the second resets (D-19). */
	private renderReset(setting: Setting): () => void {
		let timer: number | null = null;
		const disarm = (): void => {
			if (timer !== null) window.clearTimeout(timer);
			timer = null;
		};
		setting.addButton((b) => {
			b.setButtonText('Reset').setDestructive().onClick(() => {
				if (timer === null) {
					b.setButtonText('Confirm reset');
					timer = window.setTimeout(() => {
						timer = null;
						b.setButtonText('Reset');
					}, RESET_CONFIRM_MS);
					return;
				}
				disarm();
				this.store.resetAll();
				this.update();
			});
		});
		return disarm;
	}
}

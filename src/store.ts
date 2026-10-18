import { debounce, type Debounced, type Timers } from './core/debounce';
import { defaultData, loadData, validateSettings, validateViewState } from './core/settings';
import type { Settings, StoredData, ViewDefaults, ViewState } from './core/types';

export type ChangeKind = 'settings' | 'viewState';
type Listener = (kind: ChangeKind) => void;

/**
 * Single owner of settings and view state. The view, the popover and the
 * settings tab all go through it, so a change in one shows up in the others.
 */
export class Store {
	private data: StoredData = defaultData();
	private listeners = new Set<Listener>();
	private saver: Debounced;
	private loaded = false;

	constructor(
		private read: () => Promise<unknown>,
		private write: (data: StoredData) => Promise<void>,
		timers: Timers,
	) {
		this.saver = debounce(() => void this.write(this.data), 300, timers);
	}

	get settings(): Readonly<Settings> {
		return this.data.settings;
	}

	get viewState(): Readonly<ViewState> {
		return this.data.viewState;
	}

	async load(): Promise<void> {
		// "Start with: Defaults" only applies at launch, not when sync rewrites data.json.
		const atStartup = !this.loaded;
		this.data = loadData(await this.read(), atStartup);
		this.loaded = true;
		this.emit('settings');
		this.emit('viewState');
	}

	updateSettings(patch: Partial<Settings>): void {
		const next = validateSettings({ ...this.data.settings, ...patch });
		if (sameJson(next, this.data.settings)) return;
		this.data = { ...this.data, settings: next };
		this.changed('settings');
	}

	updateDefaults(patch: Partial<ViewDefaults>): void {
		this.updateSettings({ defaults: { ...this.data.settings.defaults, ...patch } });
	}

	updateViewState(patch: Partial<ViewState>): void {
		const next = validateViewState({ ...this.data.viewState, ...patch });
		if (sameJson(next, this.data.viewState)) return;
		this.data = { ...this.data, viewState: next };
		this.changed('viewState');
	}

	resetAll(): void {
		this.data = defaultData();
		this.saver.call();
		this.emit('settings');
		this.emit('viewState');
	}

	subscribe(fn: Listener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/** Writes any pending change now (used on unload). */
	flush(): void {
		this.saver.flush();
	}

	private changed(kind: ChangeKind): void {
		this.saver.call();
		this.emit(kind);
	}

	private emit(kind: ChangeKind): void {
		for (const fn of this.listeners) fn(kind);
	}
}

function sameJson(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

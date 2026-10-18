import { setIcon, type App, type Component, type TFile } from 'obsidian';
import { NoteSuggest } from '../obsidian/note-suggest';
import { COPY } from './copy';

/** The borderless search field at the top centre: a note switcher over the whole vault (D-38). */
export class SearchBox {
	readonly input: HTMLInputElement;
	private clear: HTMLElement;
	private suggest: NoteSuggest;

	constructor(parent: HTMLElement, owner: Component, app: App, id: string, onChoose: (file: TFile, evt: MouseEvent | KeyboardEvent) => void) {
		const box = parent.createDiv({ cls: 'lr-search' });
		setIcon(box.createSpan({ cls: 'lr-search-icon' }), 'search');
		// A real label instead of aria-label, which Obsidian would show as a hover tooltip.
		box.createEl('label', { cls: 'lr-sr-only', text: COPY.searchPlaceholder, attr: { for: id } });
		this.input = box.createEl('input', {
			cls: 'lr-search-input',
			attr: { id, type: 'search', placeholder: COPY.searchPlaceholder, spellcheck: 'false', autocomplete: 'off', enterkeyhint: 'go' },
		});
		this.clear = box.createEl('button', { cls: 'clickable-icon lr-search-clear lr-hidden', attr: { 'aria-label': COPY.clearSearch } });
		setIcon(this.clear, 'x');

		this.suggest = new NoteSuggest(app, this.input, (file, evt) => {
			this.syncClear();
			this.input.blur();
			onChoose(file, evt);
		});

		owner.registerDomEvent(this.input, 'input', () => this.syncClear());
		// The suggest popover handles arrows, Enter and its own Esc; this Esc only runs once it is closed.
		owner.registerDomEvent(this.input, 'keydown', (e) => {
			if (e.key !== 'Escape' || e.defaultPrevented) return;
			e.preventDefault();
			if (this.input.value === '') this.input.blur();
			else this.set('');
		});
		owner.registerDomEvent(this.clear, 'click', () => {
			this.set('');
			this.input.focus();
		});
		owner.register(() => this.suggest.close());
	}

	set(query: string): void {
		this.suggest.setValue(query);
		this.syncClear();
		if (query === '') this.suggest.close();
	}

	focus(): void {
		this.input.focus();
		this.input.select();
	}

	private syncClear(): void {
		this.clear.toggleClass('lr-hidden', this.input.value === '');
	}
}

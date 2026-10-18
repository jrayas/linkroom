import { AbstractInputSuggest, parseFrontMatterAliases, prepareFuzzySearch, renderResults, type App, type TFile } from 'obsidian';
import { folderOf } from '../core/paths';
import { rankNotes, type MatcherFactory, type NoteEntry, type NoteMatch } from '../core/switcher';

const LIMIT = 30;
const RECENT_LIMIT = 10;

/** Obsidian's own fuzzy matcher, the one the quick switcher uses. */
const fuzzy: MatcherFactory = (query) => {
	const search = prepareFuzzySearch(query);
	return (text) => search(text);
};

/**
 * The dropdown under Linkroom's search field: a quick switcher over every
 * markdown note (D-38). Choosing a note hands it to `onChoose`.
 */
export class NoteSuggest extends AbstractInputSuggest<NoteMatch> {
	/** Rendered rows, so Cmd/Ctrl+Enter can find the highlighted one without private APIs. */
	private rows = new Map<HTMLElement, NoteMatch>();

	constructor(app: App, private input: HTMLInputElement, private onChoose: (file: TFile, evt: MouseEvent | KeyboardEvent) => void) {
		super(app, input);
		this.limit = LIMIT;
		// The popover only binds a plain Enter; Cmd/Ctrl+Enter opens the choice in a new tab (D-44).
		this.scope.register(['Mod'], 'Enter', (evt) => {
			const selected = [...this.rows.entries()].find(([el]) => (el.closest('.suggestion-item') ?? el).hasClass('is-selected'));
			if (selected) this.selectSuggestion(selected[1], evt);
			return false;
		});
	}

	protected getSuggestions(query: string): NoteMatch[] {
		this.rows.clear();
		if (query.trim() === '') return this.recent();
		const entries = this.app.vault.getMarkdownFiles().map((f) => this.entry(f));
		return rankNotes(entries, query, fuzzy, LIMIT);
	}

	renderSuggestion(m: NoteMatch, el: HTMLElement): void {
		this.rows.set(el, m);
		el.addClass('lr-suggest');
		const title = el.createDiv({ cls: 'lr-suggest-title' });
		const result = { score: m.score, matches: m.matches };
		if (m.field === 'name') renderResults(title.createSpan(), m.entry.name, result);
		else title.createSpan({ text: m.entry.name });
		if (m.field === 'alias') renderResults(title.createSpan({ cls: 'lr-suggest-alias' }), m.text, result);
		const note = el.createDiv({ cls: 'lr-suggest-path' });
		if (m.field === 'path') renderResults(note, m.text, result);
		else if (m.entry.folder !== '') note.setText(m.entry.folder);
		else note.remove();
	}

	selectSuggestion(m: NoteMatch, evt: MouseEvent | KeyboardEvent): void {
		const file = this.app.vault.getFileByPath(m.entry.path);
		this.rows.clear();
		this.setValue('');
		this.input.dispatchEvent(new Event('input'));
		this.close();
		if (file) this.onChoose(file, evt);
	}

	private entry(file: TFile): NoteEntry {
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
		return { path: file.path, name: file.basename, folder: folderOf(file.path), aliases: parseFrontMatterAliases(fm) ?? [] };
	}

	/** Empty field: recently opened notes, like the quick switcher. */
	private recent(): NoteMatch[] {
		const out: NoteMatch[] = [];
		for (const path of this.app.workspace.getLastOpenFiles()) {
			const file = this.app.vault.getFileByPath(path);
			if (!file || file.extension !== 'md') continue;
			const entry = this.entry(file);
			out.push({ entry, field: 'name', text: entry.name, score: 0, matches: [] });
			if (out.length >= RECENT_LIMIT) break;
		}
		return out;
	}
}

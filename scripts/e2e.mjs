// End-to-end checks from docs/09-testing.md, run against the isolated Obsidian.
// Usage: npm run debug:launch && node scripts/e2e.mjs
import { connect } from './cdp.mjs';

const c = await connect('main');
const results = [];

// Helpers installed in the page once.
await c.evaluate(`(() => {
	window.__lr = {
		w: (ms) => new Promise((r) => setTimeout(r, ms)),
		ws: () => app.workspace,
		view: () => app.workspace.getLeavesOfType('linkroom')[0]?.view,
		root: () => document.querySelector('.lr-root'),
		names: () => [...document.querySelectorAll('.lr-root .lr-item')].map((i) => i.querySelector('.lr-name').textContent),
		headings: () => [...document.querySelectorAll('.lr-root .lr-heading')].map((h) => h.textContent),
		title: () => document.querySelector('.lr-root .lr-title')?.textContent ?? '',
		status: () => document.querySelector('.lr-root .lr-status')?.textContent ?? '',
		store: () => app.plugins.plugins.linkroom.store,
		async open(path) {
			const ws = app.workspace;
			let leaf = ws.getLeavesOfType('markdown')[0];
			if (!leaf) leaf = ws.getLeaf('tab');
			await leaf.openFile(app.vault.getFileByPath(path));
			ws.setActiveLeaf(leaf, { focus: true });
			await this.w(300);
			return leaf;
		},
		async showLinkroom() {
			app.commands.executeCommandById('linkroom:open');
			await this.w(500);
		},
		async search(q) {
			const i = document.querySelector('.lr-root .lr-search-input');
			i.value = q;
			i.dispatchEvent(new Event('input'));
			await this.w(120);
		},
		key(el, key, opts = {}) {
			el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
		},
		item(name) {
			return [...document.querySelectorAll('.lr-root .lr-item')].find((i) => i.querySelector('.lr-name').textContent === name);
		},
		cols() {
			const g = document.querySelector('.lr-root .lr-grid');
			return getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
		},
	};
	return true;
})()`);

async function check(name, js, expect) {
	try {
		const got = await c.evaluate(`(async () => { const L = window.__lr; ${js} })()`);
		const ok = typeof expect === 'function' ? expect(got) : JSON.stringify(got) === JSON.stringify(expect);
		results.push({ name, ok, got });
	} catch (e) {
		results.push({ name, ok: false, got: String(e.message ?? e) });
	}
}

// Reset to defaults and a clean layout.
await c.evaluate(`(async () => {
	const L = window.__lr;
	L.store().resetAll();
	app.workspace.getLeavesOfType('linkroom').forEach((l) => l.detach());
	app.vault.setConfig('nativeMenus', false);
	await L.open('Trip Plan.md');
	return true;
})()`);

// 1. Open and single instance
await check('1 command opens one tab; second open focuses it', `
	await L.showLinkroom(); await L.showLinkroom();
	return [app.workspace.getLeavesOfType('linkroom').length, app.workspace.getMostRecentLeaf()?.view.getViewType()];
`, [1, 'linkroom']);
await check('1 ribbon icon present', `return !!document.querySelector('.side-dock-ribbon-action[aria-label="Open linked notes"]');`, true);

// 2. Content of Trip Plan
await check('2 Trip Plan title, headings and items', `
	return [L.title(), L.headings(), L.names()];
`, ['Trip Plan', ['Both ways3', 'Outgoing4', 'Backlinks1'],
	['Hotel Booking', 'Packing List', 'Weekend Ideas',
		'Annual Budget Plan for 2026', 'Currency Notes', 'Flight Details', 'Visa Checklist',
		'Travel Journal']]);
await check('2 each note appears once (D-42)', `
	const n = L.names(); return n.length === new Set(n).size;
`, true);
await check('2 no border on the page', `
	const els = [L.root(), ...L.root().querySelectorAll('*:not(.lr-popover):not(.lr-popover *)')];
	return els.filter((e) => ['Top','Right','Bottom','Left'].some((s) => parseFloat(getComputedStyle(e)['border' + s + 'Width']) > 0 && getComputedStyle(e)['border' + s + 'Style'] !== 'none')).map((e) => e.className);
`, []);
await check('2 unresolved item is dotted and disabled', `
	const u = L.item('Currency Notes');
	return [u.classList.contains('is-unresolved'), u.getAttribute('aria-disabled'), getComputedStyle(u.querySelector('.lr-name')).textDecorationStyle];
`, [true, 'true', 'dotted']);

// 3. Following and pinning
await check('3 follows the active note', `
	await L.open('Edge Cases.md'); await L.showLinkroom(); return L.title();
`, 'Edge Cases');
await check('3 ignores non-markdown leaves', `
	const leaf = app.workspace.getLeaf('tab'); await leaf.openFile(app.vault.getFileByPath('Board.canvas'));
	app.workspace.setActiveLeaf(leaf, { focus: true }); await L.w(300);
	await L.showLinkroom(); const t = L.title(); leaf.detach(); return t;
`, 'Edge Cases');
await check('3 rename of the shown note is followed', `
	await L.open('Edge Cases.md'); await L.showLinkroom();
	const f = app.vault.getFileByPath('Edge Cases.md'); await app.fileManager.renameFile(f, 'Edge Cases 2.md'); await L.w(500);
	const t = L.title(); await app.fileManager.renameFile(app.vault.getFileByPath('Edge Cases 2.md'), 'Edge Cases.md'); await L.w(300);
	return t;
`, 'Edge Cases 2');
await check('3 delete of the shown note falls back to another note', `
	const f = await app.vault.create('Temp Note.md', 'x [[Trip Plan]]');
	await L.open('Trip Plan.md');
	const tab = app.workspace.getLeaf('tab'); await tab.openFile(f); app.workspace.setActiveLeaf(tab, { focus: true }); await L.w(300);
	await L.showLinkroom(); const before = L.title();
	await app.vault.delete(f); await L.w(500);
	tab.detach();
	return [before, L.title() !== 'Temp Note' && L.title() !== ''];
`, ['Temp Note', true]);
await check('3 no pin option anywhere (D-43)', `
	return [!!document.querySelector('.lr-root .lr-pin'), [...document.querySelectorAll('.lr-root .lr-pop-label')].map((e) => e.textContent).includes('Pin this note')];
`, [false, false]);

// 4. Display options
await check('4 show folders adds folder lines', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	L.store().updateViewState({ showFolders: true }); await L.w(100);
	const f = [...document.querySelectorAll('.lr-root .lr-folder')].map((e) => e.textContent);
	L.store().updateViewState({ showFolders: false }); await L.w(100);
	return [f.includes('Travel/Bookings'), document.querySelectorAll('.lr-root .lr-folder').length];
`, [true, 0]);
await check('4 show aliases', `
	L.store().updateViewState({ showAliases: true }); await L.w(100);
	const a = L.item('Hotel Booking').querySelector('.lr-aliases')?.textContent;
	L.store().updateViewState({ showAliases: false }); await L.w(100);
	return a;
`, 'Booking · Hotel');
await check('4 headings off: one grid, both ways then outgoing then backlinks', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	L.store().updateViewState({ showHeadings: false }); await L.w(100);
	const r = [L.headings().length, document.querySelectorAll('.lr-root .lr-grid').length, L.names()];
	L.store().updateViewState({ showHeadings: true }); await L.w(100);
	return r;
`, [0, 1, ['Hotel Booking', 'Packing List', 'Weekend Ideas', 'Annual Budget Plan for 2026', 'Currency Notes', 'Flight Details', 'Visa Checklist', 'Travel Journal']]);
await check('4 group toggles and all-off hint', `
	L.store().updateViewState({ showOutgoing: false }); await L.w(100);
	const a = L.headings();
	L.store().updateViewState({ showBoth: false }); await L.w(100);
	const b = [L.headings(), L.names().includes('Hotel Booking')];
	L.store().updateViewState({ showBacklinks: false }); await L.w(100);
	const c2 = L.status();
	L.store().updateViewState({ showBoth: true, showOutgoing: true, showBacklinks: true }); await L.w(100);
	return [a, b, c2];
`, [['Both ways3', 'Backlinks1'], [['Backlinks1'], false], 'Turn on a group in the view options to see links.']);
await check('4 empty one-way groups are left out while Both ways has notes', `
	await L.open('Travel/Bookings/Hotel Booking.md'); await L.showLinkroom();
	const r = [L.title(), L.headings()];
	await L.open('Trip Plan.md'); await L.showLinkroom();
	return r;
`, ['Hotel Booking', ['Both ways1', 'Backlinks1']]);
await check('4 columns 1/2/3/4/auto', `
	const out = [];
	for (const c of ['1', '2', '3', '4', 'auto']) { L.store().updateViewState({ columns: c }); await L.w(100); out.push(L.cols()); }
	L.store().updateViewState({ columns: '2' }); await L.w(100);
	return out;
`, (got) => JSON.stringify(got.slice(0, 4)) === '[1,2,3,4]' && got[4] >= 1 && got[4] <= 4);
await check('4 sorts within groups', `
	const out = {};
	for (const s of ['za', 'appearance']) { L.store().updateViewState({ sort: s }); await L.w(100); out[s] = L.names().slice(0, 7); }
	L.store().updateViewState({ sort: 'az' }); await L.w(100);
	return out;
`, { za: ['Weekend Ideas', 'Packing List', 'Hotel Booking', 'Visa Checklist', 'Flight Details', 'Currency Notes', 'Annual Budget Plan for 2026'],
	appearance: ['Weekend Ideas', 'Hotel Booking', 'Packing List', 'Flight Details', 'Visa Checklist', 'Annual Budget Plan for 2026', 'Currency Notes'] });
await check('4 duplicate names show folders; unicode and numbers sort', `
	await L.open('Edge Cases.md'); await L.showLinkroom();
	const meetings = [...document.querySelectorAll('.lr-root .lr-item')].filter((i) => i.querySelector('.lr-name').textContent === 'Meeting').map((i) => i.querySelector('.lr-folder')?.textContent);
	const n = L.names();
	return [meetings.slice(0, 2).sort(), n.indexOf('Day 2') < n.indexOf('Day 10'), n.includes('東京'), n.includes('Board.canvas') || n.includes('Guide.pdf') || n.includes('photo.png')];
`, [['Home', 'Work'], true, true, false]);

// 5. Search: a note switcher over the whole vault (D-38). Real typing and keys through CDP.
const typeInSearch = async (text) => {
	await c.evaluate(`(async () => { const i = document.querySelector('.lr-root .lr-search-input'); i.focus(); i.select(); return 1; })()`);
	await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
	await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
	if (text) await c.send('Input.insertText', { text });
	await new Promise((r) => setTimeout(r, 300));
};
const press = async (key, code, vk) => {
	await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk });
	await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
	await new Promise((r) => setTimeout(r, 300));
};
const dropdown = `[...document.querySelectorAll('.suggestion-container .lr-suggest')].map((s) => s.querySelector('.lr-suggest-title').textContent)`;

await c.evaluate(`(async () => { const L = window.__lr; await L.open('Trip Plan.md'); await L.showLinkroom(); return 1; })()`);
await typeInSearch('trav');
await check('5 typing lists vault notes in a dropdown, best first', `return ${dropdown}.slice(0, 2);`,
	(got) => got[0] === 'Travel Journal' && got.length === 2);
await check('5 the grid is not filtered while typing', `return L.names().length;`, 8);
await check('5 matched characters are emphasised', `return document.querySelector('.suggestion-container .lr-suggest .suggestion-highlight')?.textContent ?? null;`,
	(got) => typeof got === 'string' && got.length > 0);
await typeInSearch('kickoff');
await check('5 finds notes outside the current links', `return ${dropdown}[0];`, 'Kickoff');
await typeInSearch('booking');
await check('5 matches aliases and paths', `return ${dropdown};`, (got) => got[0]?.startsWith('Hotel Booking'));
await typeInSearch('zzzz');
await check('5 no results closes the dropdown', `return document.querySelectorAll('.suggestion-container .lr-suggest').length;`, 0);
await typeInSearch('journal');
const mdBefore = await c.evaluate(`app.workspace.getLeavesOfType('markdown').map((l) => l.view.file?.path).join()`);
await press('Enter', 'Enter', 13);
await check('5 Enter opens the note behind Linkroom and the page shows it (D-44)', `
	await L.w(400);
	const md = app.workspace.getLeavesOfType('markdown');
	return [L.title(), document.querySelector('.lr-root .lr-search-input').value,
		md.length === ${JSON.stringify(mdBefore)}.split(',').length,
		md.some((l) => l.view.file?.path === 'Journal/2026/Travel Journal.md'),
		app.workspace.getMostRecentLeaf()?.view.getViewType(),
		L.headings()];
`, ['Travel Journal', '', true, true, 'linkroom', ['Outgoing1', 'Backlinks0']]);
await check('5 switching notes in the editor moves the page on (no pin)', `
	await L.open('Weekend Ideas.md'); await L.showLinkroom(); return L.title();
`, 'Weekend Ideas');
await typeInSearch('hub note 04');
await press('ArrowDown', 'ArrowDown', 40);
const second = await c.evaluate(`document.querySelector('.suggestion-container .suggestion-item.is-selected .lr-suggest-title')?.textContent ?? null`);
await check('5 arrow keys move through results', `return ${JSON.stringify(second)} !== null && ${JSON.stringify(second)} !== ${dropdown}[0];`, true);
await press('Escape', 'Escape', 27);
await check('5 Esc closes the dropdown first', `
	return [document.querySelectorAll('.suggestion-container .lr-suggest').length, document.querySelector('.lr-root .lr-search-input').value];
`, [0, 'hub note 04']);
await press('Escape', 'Escape', 27);
await check('5 second Esc clears, third leaves the field', `
	const i = document.querySelector('.lr-root .lr-search-input'); const v = i.value;
	i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	return [v, document.activeElement === i];
`, ['', false]);
await check('5 clicking a result works too', `
	const i = document.querySelector('.lr-root .lr-search-input'); i.focus(); i.value = 'edge'; i.dispatchEvent(new Event('input')); await L.w(300);
	const first = document.querySelector('.suggestion-container .lr-suggest'); first?.click(); await L.w(400);
	return [L.title(), app.workspace.getMostRecentLeaf()?.view.getViewType()];
`, ['Edge Cases', 'linkroom']);
await c.evaluate(`(() => { app.workspace.getLeavesOfType('markdown').filter((l) => l.view.file?.basename === 'Kickoff').forEach((l) => l.detach()); return 1; })()`);
await typeInSearch('kickoff');
await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 4 });
await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 4 });
await new Promise((r) => setTimeout(r, 400));
await check('5 Cmd+Enter opens the note in a new background tab', `
	const md = app.workspace.getLeavesOfType('markdown');
	const r = [L.title(), md.filter((l) => l.view.file?.basename === 'Kickoff').length, app.workspace.getMostRecentLeaf()?.view.getViewType()];
	md.filter((l) => l.view.file?.basename === 'Kickoff').forEach((l) => l.detach());
	return r;
`, ['Kickoff', 1, 'linkroom']);

// 6. Click rules
await check('6 plain click reuses the markdown tab; Linkroom stays open', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	const before = app.workspace.getLeavesOfType('markdown').length;
	L.item('Visa Checklist').dispatchEvent(new MouseEvent('click', { bubbles: true })); await L.w(400);
	return [app.workspace.getLeavesOfType('markdown').length - before, app.workspace.getLeavesOfType('linkroom').length, app.workspace.getActiveFile()?.basename];
`, [0, 1, 'Visa Checklist']);
await check('6 Cmd-click opens a new tab', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	const before = app.workspace.getLeavesOfType('markdown').length;
	L.item('Flight Details').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })); await L.w(400);
	return app.workspace.getLeavesOfType('markdown').length - before;
`, 1);
await check('6 Cmd+Alt-click opens a split', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	const parentsBefore = new Set(app.workspace.getLeavesOfType('markdown').map((l) => l.parent)).size;
	L.item('Packing List').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true, altKey: true })); await L.w(400);
	const parentsAfter = new Set(app.workspace.getLeavesOfType('markdown').map((l) => l.parent)).size;
	return parentsAfter > parentsBefore;
`, true);
await check('6 middle click opens a new tab', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	const before = app.workspace.getLeavesOfType('markdown').length;
	L.item('Hotel Booking').dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 })); await L.w(400);
	return app.workspace.getLeavesOfType('markdown').length - before;
`, 1);
await check('6 unresolved item does nothing', `
	await L.open('Trip Plan.md'); await L.showLinkroom();
	const before = app.workspace.getLeavesOfType('markdown').length;
	L.item('Currency Notes').dispatchEvent(new MouseEvent('click', { bubbles: true })); await L.w(300);
	return [app.workspace.getLeavesOfType('markdown').length - before, !app.vault.getFileByPath('Currency Notes.md')];
`, [0, true]);
// Tidy extra tabs and splits.
await c.evaluate(`(async () => { const md = app.workspace.getLeavesOfType('markdown'); md.slice(1).forEach((l) => l.detach()); await window.__lr.open('Trip Plan.md'); await window.__lr.showLinkroom(); return true; })()`);

// 7. Hover and menu
// Page preview needs a real :hover, so drive the mouse through CDP with Cmd held.
{
	const rect = await c.evaluate(`(async () => { const L = window.__lr; await L.open('Trip Plan.md'); await L.showLinkroom();
		const r = L.item('Hotel Booking').querySelector('.lr-name').getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; })()`);
	await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x - 200, y: rect.y - 100 });
	await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Meta', code: 'MetaLeft', modifiers: 4 });
	await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y, modifiers: 4 });
	await check('7 hover with Cmd shows page preview', `
		await L.w(1200);
		return document.querySelector('.hover-popover')?.textContent.includes('Back to') ?? false;
	`, true);
	await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Meta', code: 'MetaLeft' });
	await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
	await c.evaluate(`(async () => { await window.__lr.w(400); document.querySelectorAll('.hover-popover').forEach((p) => p.remove()); return true; })()`);
}
await check('7 context menu has only the four read-only items', `
	const el = L.item('Hotel Booking');
	el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })); await L.w(200);
	const items = [...activeDocument.querySelectorAll('.menu .menu-item-title')].map((e) => e.textContent);
	activeDocument.querySelectorAll('.menu').forEach((m) => m.remove());
	return items;
`, ['Open', 'Open in new tab', 'Open to the right', 'Reveal in file explorer']);
await check('7 reveal in file explorer runs without error', `
	const el = L.item('Hotel Booking');
	el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })); await L.w(200);
	const item = [...activeDocument.querySelectorAll('.menu .menu-item')].find((e) => e.textContent.includes('Reveal'));
	item.click(); await L.w(400);
	return !!document.querySelector('.nav-file-title.has-focus[data-path="Travel/Bookings/Hotel Booking.md"]');
`, true);

// 8. Keyboard
await check('8 roving tabindex and arrow keys across sections', `
	await L.showLinkroom();
	const items = [...document.querySelectorAll('.lr-root .lr-item')];
	const tab0 = items.filter((i) => i.tabIndex === 0).length;
	items[0].focus();
	L.key(items[0], 'ArrowDown'); const a = document.activeElement.querySelector('.lr-name').textContent;
	L.key(document.activeElement, 'End'); const b = document.activeElement.querySelector('.lr-name').textContent;
	L.key(document.activeElement, 'ArrowUp'); const c2 = document.activeElement.querySelector('.lr-name').textContent;
	L.key(document.activeElement, 'Home'); const d = document.activeElement.querySelector('.lr-name').textContent;
	return [tab0, a, b, c2, d];
`, [1, 'Weekend Ideas', 'Travel Journal', 'Flight Details', 'Hotel Booking']);
await check('8 slash focuses search', `
	const it = document.querySelector('.lr-root .lr-item'); it.focus();
	L.key(it, '/'); return document.activeElement.classList.contains('lr-search-input');
`, true);

// Popover
await check('P gear opens popover, Esc closes and returns focus', `
	const gear = document.querySelector('.lr-root .lr-gear'); gear.click(); await L.w(150);
	const open = document.querySelector('.lr-root .lr-popover').classList.contains('is-open') && gear.getAttribute('aria-expanded') === 'true';
	L.key(document.activeElement, 'Escape'); await L.w(150);
	return [open, document.querySelector('.lr-root .lr-popover').classList.contains('is-open'), document.activeElement === gear];
`, [true, false, true]);
await check('P popover toggle and columns change the page and persist', `
	const gear = document.querySelector('.lr-root .lr-gear'); gear.click(); await L.w(150);
	const row = [...document.querySelectorAll('.lr-root .lr-pop-row')].find((r) => r.textContent.startsWith('Show folders'));
	row.querySelector('.checkbox-container').click(); await L.w(100);
	[...document.querySelectorAll('.lr-root .lr-seg-btn')].find((b) => b.textContent === '3').click(); await L.w(100);
	const r = [L.store().viewState.showFolders, L.cols(), document.querySelectorAll('.lr-root .lr-folder').length > 0];
	document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await L.w(150);
	const closed = !document.querySelector('.lr-root .lr-popover').classList.contains('is-open');
	L.store().updateViewState({ showFolders: false, columns: '2' }); await L.w(100);
	return [...r, closed];
`, [true, 3, true, true]);

// 9. Appearance settings via the store (the settings page itself is checked separately in its own window)
await check('9 appearance settings reach CSS variables', `
	const s = L.store();
	s.updateSettings({ fontSize: 'large', underlineThickness: 'regular', rowSpacing: 'spacious', linkColourMode: 'custom', customLinkColour: '#ff0000', wrapLongNames: true, maxWrapLines: 3 }); await L.w(100);
	const st = L.root().style;
	const r = ['--lr-font-size', '--lr-underline-thickness', '--lr-row-gap', '--lr-link', '--lr-link-text', '--lr-max-lines'].map((v) => st.getPropertyValue(v).trim());
	const wrap = L.root().classList.contains('lr-wrap');
	s.resetAll(); await L.w(100);
	return [...r, wrap, L.root().style.getPropertyValue('--lr-link').trim()];
`, ['var(--font-ui-large, 18px)', '2px', '1.4rem', '#ff0000', '#ff0000', '3', true, 'var(--interactive-accent)']);
await check('9 unresolved hidden setting', `
	L.store().updateSettings({ unresolvedLinks: 'hidden' }); await L.w(100);
	const n = L.names().includes('Currency Notes');
	L.store().updateSettings({ unresolvedLinks: 'dimmed' }); await L.w(100);
	return n;
`, false);

// 11. Link styles (D-45), with a real mouse for hover.
const nameRect = (name) => c.evaluate(`(() => { const r = window.__lr.item(${JSON.stringify(name)}).querySelector('.lr-name').getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; })()`);
const hoverAt = async (p) => { await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await new Promise((r) => setTimeout(r, 350)); };
const away = async () => { await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await new Promise((r) => setTimeout(r, 350)); };
const probe = (name) => `(() => { const it = window.__lr.item(${JSON.stringify(name)}); const n = it.querySelector('.lr-name'); const cs = getComputedStyle(n); const a = getComputedStyle(it.querySelector('.lr-line'), '::after');
	return { colour: cs.color, bgSize: cs.backgroundSize, deco: cs.textDecorationColor, chevron: a.content, chevronOpacity: a.opacity, tile: getComputedStyle(it).backgroundColor, text: getComputedStyle(document.body).color }; })()`;
for (const style of ['hairline', 'apple', 'tile']) {
	await c.evaluate(`(async () => { const L = window.__lr; await L.open('Trip Plan.md'); await L.showLinkroom(); L.store().updateSettings({ linkStyle: '${style}' }); await L.w(250); return 1; })()`);
	await away();
	const rest = await c.evaluate(probe('Flight Details'));
	await hoverAt(await nameRect('Flight Details'));
	const hover = await c.evaluate(probe('Flight Details'));
	await away();
	const cls = await c.evaluate(`window.__lr.root().classList.contains('lr-style-${style}')`);
	let ok = cls;
	if (style === 'hairline') ok = ok && rest.bgSize.startsWith('0%') && hover.bgSize.startsWith('100%') && rest.colour !== hover.colour && rest.chevron === 'none';
	if (style === 'apple') ok = ok && rest.colour === hover.colour && rest.colour !== rest.text && rest.chevronOpacity === '0' && hover.chevronOpacity === '1' && rest.deco !== hover.deco;
	if (style === 'tile') ok = ok && rest.tile === 'rgba(0, 0, 0, 0)' && hover.tile !== rest.tile && hover.chevronOpacity === '1' && rest.colour !== hover.colour;
	results.push({ name: `11 link style ${style}: rest and hover`, ok, got: { rest, hover } });
}
await check('11 unresolved looks the same in every style and has no chevron', `
	const out = [];
	for (const s of ['hairline', 'apple', 'tile']) { L.store().updateSettings({ linkStyle: s }); await L.w(150);
		const it = L.item('Currency Notes'); out.push([getComputedStyle(it.querySelector('.lr-name')).textDecorationStyle, getComputedStyle(it.querySelector('.lr-line'), '::after').content]); }
	L.store().resetAll(); await L.w(150);
	return out;
`, [['dotted', 'none'], ['dotted', 'none'], ['dotted', 'none']]);
await check('11 underline thickness row only for Hairline; pale link colour falls back in Sky link', `
	app.changeTheme('moonstone'); await L.w(300);
	L.store().updateSettings({ linkStyle: 'apple', linkColourMode: 'custom', customLinkColour: '#f4f4ff' }); await L.w(200);
	const pale = [L.root().classList.contains('lr-link-pale'), getComputedStyle(L.item('Flight Details').querySelector('.lr-name')).color === getComputedStyle(L.root()).color];
	L.store().resetAll(); app.changeTheme('obsidian'); await L.w(300);
	return [...pale, L.root().classList.contains('lr-link-pale')];
`, [true, true, false]);
await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await check('11 reduced motion removes transitions', `
	await L.w(100);
	return [getComputedStyle(L.item('Flight Details').querySelector('.lr-name')).transitionDuration, getComputedStyle(document.querySelector('.lr-root .lr-popover')).transitionDuration];
`, (got) => got.every((d) => d.split(',').every((x) => parseFloat(x) === 0)));
await c.send('Emulation.setEmulatedMedia', { features: [] });

// 10. Persistence
await check('10 view state persists across plugin reload', `
	L.store().updateViewState({ columns: '3', showAliases: true, showBoth: false });
	await L.w(400);
	await app.plugins.disablePlugin('linkroom'); await app.plugins.enablePlugin('linkroom'); await L.w(800);
	const vs = L.store().viewState;
	const r = [vs.columns, vs.showAliases, vs.showBoth];
	L.store().updateViewState({ showBoth: true }); await L.w(400);
	return r;
`, ['3', true, false]);
await check('10 version 1 data migrates on load (D-47)', `
	await app.plugins.disablePlugin('linkroom');
	await app.vault.adapter.write(app.vault.configDir + '/plugins/linkroom/data.json', JSON.stringify({ schemaVersion: 1, settings: { underlineColourMode: 'custom', customUnderlineColour: '#123456', keepSearch: true }, viewState: { columns: '4' } }));
	await app.plugins.enablePlugin('linkroom'); await L.w(800);
	const s = L.store().settings;
	const r = [s.linkColourMode, s.customLinkColour, s.linkStyle, L.store().viewState.columns, L.store().viewState.showBoth];
	L.store().resetAll(); await L.w(400);
	return r;
`, ['custom', '#123456', 'hairline', '4', true]);
await check('10 Start with: Defaults applies at startup', `
	L.store().updateSettings({ startWith: 'defaults' }); await L.w(400);
	await app.plugins.disablePlugin('linkroom'); await app.plugins.enablePlugin('linkroom'); await L.w(800);
	const vs = L.store().viewState;
	const r = [vs.columns, vs.showAliases];
	L.store().resetAll(); await L.w(400);
	return r;
`, ['2', false]);

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      got: ${JSON.stringify(r.got)}`}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
c.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

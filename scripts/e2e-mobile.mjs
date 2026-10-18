// Touch checks under emulation (app.emulateMobile(true) must be on). Real devices are not covered.
// Usage: node scripts/e2e-mobile.mjs [screenshot.png]
import fs from 'node:fs';
import { connect, sleep } from './cdp.mjs';

const c = await connect('main');
const results = [];
const ok = (name, pass, got) => results.push({ name, pass, got });
const touch = async (x, y, hold) => {
	await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	await sleep(hold);
	await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await sleep(500);
};
const at = (name) => c.evaluate(`(() => { const e = [...document.querySelectorAll('.lr-root .lr-item')].find(i => i.querySelector('.lr-name').textContent === ${JSON.stringify(name)}); const b = e.getBoundingClientRect(); return { x: b.x + 20, y: b.y + b.height / 2 }; })()`);
const reset = () => c.evaluate(`(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms));
	document.querySelectorAll('.menu').forEach(m => m.remove());
	app.workspace.getLeavesOfType('markdown').slice(1).forEach(l => l.detach());
	const leaf = app.workspace.getLeavesOfType('markdown')[0] ?? app.workspace.getLeaf('tab'); await leaf.openFile(app.vault.getFileByPath('Trip Plan.md'));
	app.workspace.setActiveLeaf(leaf, { focus: true }); await w(300);
	app.commands.executeCommandById('linkroom:open'); await w(600); return 1; })()`);

ok('mobile mode is on', await c.evaluate(`document.body.classList.contains('is-mobile')`), null);
await c.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 800, deviceScaleFactor: 2, mobile: true });
await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await reset();

// Phone layout (is-phone is set by hand: emulation keeps the tablet class at this window size).
const layout = await c.evaluate(`(async () => { document.body.classList.add('is-phone'); app.plugins.plugins.linkroom.store.updateViewState({ columns: '4' });
	await new Promise(r => setTimeout(r, 300));
	const g = document.querySelector('.lr-root .lr-grid'); const gear = document.querySelector('.lr-gear').getBoundingClientRect(); const search = document.querySelector('.lr-search').getBoundingClientRect();
	return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, itemHeight: document.querySelector('.lr-root .lr-item').getBoundingClientRect().height, gearAboveSearch: gear.bottom <= search.top }; })()`);
ok('phone: four columns render as two', layout.cols === 2, layout);
ok('phone: touch targets at least 44 px', layout.itemHeight >= 44, layout);
ok('phone: gear does not overlap search', layout.gearAboveSearch, layout);
if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));

let p = await at('Visa Checklist');
await touch(p.x, p.y, 900);
const lp = await c.evaluate(`({ menus: document.querySelectorAll('.menu').length, items: [...document.querySelectorAll('.menu-item-title')].map(e => e.textContent), md: app.workspace.getLeavesOfType('markdown').map(l => l.view.file?.basename) })`);
ok('long-press opens one menu that stays open, without opening the note', lp.menus === 1 && lp.md.join() === 'Trip Plan', lp);
ok('phone menu hides "Open to the right" and reveal', !lp.items.includes('Open to the right') && !lp.items.includes('Reveal in file explorer'), lp.items);

const m = await c.evaluate(`(() => { const e = [...document.querySelectorAll('.menu-item')].find(i => i.textContent.includes('Open in new tab')); const b = e.getBoundingClientRect(); return { x: b.x + 20, y: b.y + b.height / 2 }; })()`);
await touch(m.x, m.y, 60);
const tabs = await c.evaluate(`app.workspace.getLeavesOfType('markdown').map(l => l.view.file?.basename)`);
ok('tapping "Open in new tab" in the menu works', tabs.length === 2 && tabs.includes('Visa Checklist'), tabs);

await reset();
p = await at('Flight Details');
await touch(p.x, p.y, 60);
const tap = await c.evaluate(`({ active: app.workspace.getActiveFile()?.basename, linkroom: app.workspace.getLeavesOfType('linkroom').length })`);
ok('a quick tap opens the note and keeps Linkroom', tap.active === 'Flight Details' && tap.linkroom === 1, tap);

await c.evaluate(`(() => { document.body.classList.remove('is-phone'); app.plugins.plugins.linkroom.store.updateViewState({ columns: '2' }); return 1; })()`);
await c.send('Emulation.setTouchEmulationEnabled', { enabled: false });
await c.send('Emulation.clearDeviceMetricsOverride');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n      got: ${JSON.stringify(r.got)}`}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
c.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

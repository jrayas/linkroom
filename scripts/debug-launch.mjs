// Starts an isolated Obsidian on a scratch copy of the fixture vault (obsidian-cdp-debugging skill).
// Never touches the owner's vaults or profile: everything lives under test-vault/.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { connect, PORT, sleep } from './cdp.mjs';

const base = path.resolve('test-vault');
const template = path.join(base, 'template');
const scratch = path.join(base, 'scratch');
const vault = path.join(scratch, 'vault');
const profile = path.join(scratch, 'profile');
const pidFile = path.join(base, 'obsidian.pid');

if (!fs.existsSync(template)) {
	console.error('No fixture vault: run npm run vault:create first.');
	process.exit(1);
}
try {
	await fetch(`http://127.0.0.1:${PORT}/json`);
	console.error(`Port ${PORT} is already in use; run npm run debug -- stop first.`);
	process.exit(1);
} catch { /* free */ }

fs.rmSync(scratch, { recursive: true, force: true });
fs.cpSync(template, vault, { recursive: true });
// Only the three release files, exactly what users receive.
const pluginDir = path.join(vault, '.obsidian', 'plugins', 'linkroom');
fs.rmSync(pluginDir, { recursive: true, force: true });
fs.mkdirSync(pluginDir, { recursive: true });
for (const f of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(f, path.join(pluginDir, f));

fs.mkdirSync(profile, { recursive: true });
const id = crypto.randomBytes(8).toString('hex');
fs.writeFileSync(path.join(profile, 'obsidian.json'), JSON.stringify({ vaults: { [id]: { path: vault, ts: Date.now(), open: true } } }));

const bins = {
	darwin: '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
	win32: path.join(process.env.LOCALAPPDATA ?? '', 'Obsidian', 'Obsidian.exe'),
	linux: '/usr/bin/obsidian',
};
const bin = process.env.OBSIDIAN_BIN ?? bins[process.platform];
const child = spawn(bin, [
	`--user-data-dir=${profile}`,
	`--remote-debugging-port=${PORT}`,
	'--remote-debugging-address=127.0.0.1',
	'--remote-allow-origins=*',
	'--disable-background-timer-throttling',
	'--disable-renderer-backgrounding',
	'--disable-backgrounding-occluded-windows',
], { detached: true, stdio: 'ignore' });
child.unref();
fs.writeFileSync(pidFile, String(child.pid));
console.log(`Started isolated Obsidian (pid ${child.pid}) on ${vault}`);

// Wait for the vault window, then accept the trust prompt (scratch vault only).
for (let i = 0; i < 60; i++) {
	await sleep(500);
	try {
		const c = await connect('main');
		const state = await c.evaluate(`(() => {
			const btn = [...document.querySelectorAll('button')].find(b => /trust author and enable plugins/i.test(b.textContent));
			if (btn) { btn.click(); return 'trusted'; }
			return typeof app !== 'undefined' && app.workspace?.layoutReady ? 'ready' : 'waiting';
		})()`);
		c.close();
		if (state === 'ready') {
			const c2 = await connect('main');
			const loaded = await c2.evaluate(`!!app.plugins.plugins.linkroom`);
			if (!loaded) await c2.evaluate(`app.plugins.setEnable(true).then(() => app.plugins.enablePlugin('linkroom'))`);
			console.log(JSON.stringify(await c2.evaluate(`({ loaded: !!app.plugins.plugins.linkroom, files: app.vault.getFiles().length })`)));
			c2.close();
			process.exit(0);
		}
	} catch { /* not up yet */ }
}
console.error('Obsidian did not become ready in 30 s.');
process.exit(1);

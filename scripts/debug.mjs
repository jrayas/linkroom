// npm run debug -- status | eval "<js>" | reload | console [ms] | screenshot [file] [--size WxH] | trust | stop
// Add --window settings after the command to target the Settings window.
import fs from 'node:fs';
import path from 'node:path';
import { connect, PORT, sleep } from './cdp.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	if (i === -1) return undefined;
	const v = args[i + 1];
	args.splice(i, 2);
	return v;
};
const window = flag('--window') ?? 'main';
const size = flag('--size');
const [cmd, ...rest] = args;
const base = path.resolve('test-vault');

async function collectConsole(c, ms) {
	await c.send('Runtime.enable');
	await c.send('Log.enable');
	await sleep(ms);
	return c.events
		.filter((e) => e.method === 'Runtime.consoleAPICalled' || e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded')
		.map((e) => {
			if (e.method === 'Runtime.consoleAPICalled') return `[${e.params.type}] ${e.params.args.map((a) => a.value ?? a.description).join(' ')}`;
			if (e.method === 'Runtime.exceptionThrown') return `[exception] ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`;
			return `[log:${e.params.entry.level}] ${e.params.entry.text}`;
		});
}

switch (cmd) {
	case 'status': {
		const c = await connect(window);
		console.log(JSON.stringify(await c.evaluate(`({ loaded: !!app.plugins.plugins.linkroom, restrictedMode: !app.plugins.isEnabled(), files: app.vault.getFiles().length })`)));
		c.close();
		break;
	}
	case 'eval': {
		const c = await connect(window);
		const v = await c.evaluate(rest.join(' '));
		console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
		c.close();
		break;
	}
	case 'reload': {
		const vaultPlugin = path.join(base, 'scratch', 'vault', '.obsidian', 'plugins', 'linkroom');
		for (const f of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(f, path.join(vaultPlugin, f));
		const c = await connect('main');
		await c.send('Runtime.enable');
		await c.evaluate(`app.plugins.disablePlugin('linkroom').then(() => app.plugins.enablePlugin('linkroom'))`);
		const out = await collectConsole(c, 1500);
		console.log(out.length ? out.join('\n') : '(no console output)');
		c.close();
		break;
	}
	case 'console': {
		const c = await connect(window);
		const out = await collectConsole(c, Number(rest[0] ?? 2000));
		console.log(out.length ? out.join('\n') : '(no console output)');
		c.close();
		break;
	}
	case 'screenshot': {
		const file = path.resolve(rest[0] ?? path.join(base, 'shots', `shot-${Date.now()}.png`));
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const c = await connect(window);
		if (size) {
			const [w, h] = size.split('x').map(Number);
			await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
			await sleep(400);
		}
		const r = await c.send('Page.captureScreenshot', { format: 'png' });
		if (size) await c.send('Emulation.clearDeviceMetricsOverride');
		fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
		console.log(file);
		c.close();
		break;
	}
	case 'trust': {
		const c = await connect('main');
		console.log(await c.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => /trust author/i.test(b.textContent)); if (b) { b.click(); return 'clicked'; } return 'no prompt'; })()`));
		c.close();
		break;
	}
	case 'stop': {
		const pidFile = path.join(base, 'obsidian.pid');
		if (!fs.existsSync(pidFile)) {
			console.log('No isolated Obsidian recorded; nothing stopped.');
			break;
		}
		const pid = Number(fs.readFileSync(pidFile, 'utf8'));
		// Only ever the process this project started.
		try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
		fs.rmSync(pidFile);
		for (let i = 0; i < 40; i++) {
			try { await fetch(`http://127.0.0.1:${PORT}/json`); await sleep(250); } catch { console.log(`Stopped pid ${pid}; port ${PORT} free.`); process.exit(0); }
		}
		console.log(`Stopped pid ${pid}; port ${PORT} still busy.`);
		break;
	}
	default:
		console.log('Usage: npm run debug -- status | eval "<js>" | reload | console [ms] | screenshot [file] [--size WxH] | trust | stop [--window settings]');
}
process.exit(0);

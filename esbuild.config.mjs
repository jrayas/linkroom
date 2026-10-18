import esbuild from 'esbuild';
import process from 'process';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const prod = process.argv[2] === 'production';

// During development the build is copied into the fixture vault so the isolated
// Obsidian picks it up; production builds only write main.js next to manifest.json.
const devPluginDir = path.join('test-vault', 'template', '.obsidian', 'plugins', 'linkroom');

function copyToVault() {
	if (prod || !fs.existsSync(path.join('test-vault', 'template'))) return;
	fs.mkdirSync(devPluginDir, { recursive: true });
	for (const f of ['main.js', 'manifest.json', 'styles.css']) {
		if (fs.existsSync(f)) fs.copyFileSync(f, path.join(devPluginDir, f));
	}
}

const context = await esbuild.context({
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: [
		'obsidian', 'electron',
		'@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
		'@codemirror/language', '@codemirror/lint', '@codemirror/search',
		'@codemirror/state', '@codemirror/view',
		'@lezer/common', '@lezer/highlight', '@lezer/lr',
		...builtinModules,
	],
	format: 'cjs',
	// iOS 15 WebKit cannot run ES2022 static blocks.
	target: 'es2021',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: 'main.js',
	minify: prod,
	plugins: [{ name: 'copy-to-vault', setup(build) { build.onEnd(copyToVault); } }],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
	// esbuild does not watch styles.css because nothing imports it.
	fs.watch('styles.css', () => copyToVault());
}

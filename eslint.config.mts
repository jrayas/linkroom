/// <reference types="node" />
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules', 'dist', 'test-vault', 'main.js',
		'esbuild.config.mjs', 'version-bump.mjs', 'scripts',
		'versions.json', 'package.json', 'package-lock.json', 'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: { ...globals.browser },
			parserOptions: {
				projectService: { allowDefaultProject: ['eslint.config.mts', 'vitest.config.mts', 'manifest.json'] },
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Core logic must stay pure so it can be unit-tested without Obsidian.
		files: ['src/core/**/*.ts'],
		rules: {
			'no-restricted-imports': ['error', { paths: [{ name: 'obsidian', message: 'src/core must not import obsidian.' }] }],
		},
	},
);

import type { Model } from './types';

/** FNV-1a hash of everything that affects rendering, so identical refreshes can be skipped. */
export function signatureOf(model: Omit<Model, 'signature'>): string {
	let h = 0x811c9dc5;
	const add = (s: string): void => {
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		h ^= 0x1f;
		h = Math.imul(h, 0x01000193);
	};
	add(model.targetPath ?? '');
	add(model.targetName);
	for (const s of model.sections) {
		add(s.kind);
		for (const it of s.items) {
			add(it.key);
			add(it.name);
			add(it.folder);
			add(it.aliases.join('\u0000'));
			add(it.needsFolder ? '1' : '0');
			add(String(it.mtime));
		}
	}
	return (h >>> 0).toString(36);
}

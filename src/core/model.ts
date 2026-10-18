import { baseName, extensionOf, folderOf } from './paths';
import { signatureOf } from './signature';
import { sortItems } from './sort';
import type { GroupKind, Item, LinkSnapshot, Model, RawLink, Section, ViewState } from './types';

export interface ModelOptions {
	hideUnresolved: boolean;
	duplicateFolders: 'auto' | 'never';
}

/** Link path without any `#heading` or `#^block` part. */
function stripSubpath(link: string): string {
	const i = link.indexOf('#');
	return i === -1 ? link : link.slice(0, i);
}

function isMarkdownPath(path: string): boolean {
	return extensionOf(path) === 'md';
}

function isMarkdownLinkText(link: string): boolean {
	const ext = extensionOf(link);
	return ext === '' || ext === 'md';
}

function toItems(raw: readonly RawLink[], group: Exclude<GroupKind, 'both'>, targetPath: string, opts: ModelOptions): Item[] {
	const seen = new Map<string, Item>();
	for (const link of raw) {
		if (link.path !== null) {
			if (link.path === targetPath || !isMarkdownPath(link.path)) continue;
			const key = `${group}:${link.path}`;
			const existing = seen.get(key);
			if (existing) {
				existing.firstOffset = minOffset(existing.firstOffset, link.firstOffset);
				continue;
			}
			seen.set(key, {
				key, group, path: link.path, name: link.name, folder: link.folder,
				aliases: link.aliases, mtime: link.mtime, firstOffset: link.firstOffset,
				unresolved: false, needsFolder: false,
			});
		} else {
			if (group === 'backlinks' || opts.hideUnresolved) continue;
			const linkPath = stripSubpath(link.linkText).trim();
			if (linkPath === '' || !isMarkdownLinkText(linkPath)) continue;
			const key = `${group}:?${linkPath.toLowerCase()}`;
			const existing = seen.get(key);
			if (existing) {
				existing.firstOffset = minOffset(existing.firstOffset, link.firstOffset);
				continue;
			}
			seen.set(key, {
				key, group, path: null, name: baseName(linkPath), folder: folderOf(linkPath),
				aliases: [], mtime: 0, firstOffset: link.firstOffset,
				unresolved: true, needsFolder: false,
			});
		}
	}
	return [...seen.values()];
}

function minOffset(a: number | null, b: number | null): number | null {
	if (a === null) return b;
	if (b === null) return a;
	return Math.min(a, b);
}

/** Marks items whose base name is shared with a different note in the displayed set. */
function markDuplicates(sections: Section[]): void {
	const byName = new Map<string, Set<string>>();
	for (const s of sections) {
		for (const it of s.items) {
			const id = it.path ?? `?${it.name.toLowerCase()}`;
			const name = it.name.toLowerCase();
			let ids = byName.get(name);
			if (!ids) byName.set(name, (ids = new Set()));
			ids.add(id);
		}
	}
	for (const s of sections) {
		for (const it of s.items) {
			it.needsFolder = (byName.get(it.name.toLowerCase())?.size ?? 0) > 1;
		}
	}
}

/**
 * Splits the links into three groups (D-42): notes linked in both directions,
 * then one-way outgoing links, then one-way backlinks. Each note appears once.
 */
export function buildModel(snapshot: LinkSnapshot, view: ViewState, opts: ModelOptions): Model {
	const target = snapshot.target;
	if (!target) return { targetPath: null, targetName: '', sections: [], signature: 'none' };

	const outgoing = toItems(snapshot.outgoing, 'outgoing', target.path, opts);
	const backlinks = toItems(snapshot.backlinks, 'backlinks', target.path, opts);
	const incoming = new Set(backlinks.map((b) => b.path));
	// Unresolved links have no path, so they can never be both ways.
	const isMutual = (it: Item): boolean => it.path !== null && incoming.has(it.path);
	const mutualPaths = new Set(outgoing.filter(isMutual).map((it) => it.path));

	const both = outgoing.filter(isMutual).map((it) => ({ ...it, key: `both:${it.path ?? ''}`, group: 'both' as const }));
	const oneWayOut = outgoing.filter((it) => !isMutual(it));
	const oneWayBack = backlinks.filter((it) => !mutualPaths.has(it.path));

	// Backlinks have no position in the target, so "order in note" falls back to names for them.
	const backSort = view.sort === 'appearance' ? 'az' : view.sort;
	const sections: Section[] = [];
	if (view.showBoth) sections.push({ kind: 'both', items: sortItems(both, view.sort) });
	if (view.showOutgoing) sections.push({ kind: 'outgoing', items: sortItems(oneWayOut, view.sort) });
	if (view.showBacklinks) sections.push({ kind: 'backlinks', items: sortItems(oneWayBack, backSort) });
	if (opts.duplicateFolders === 'auto') markDuplicates(sections);

	const model: Model = { targetPath: target.path, targetName: target.name, sections, signature: '' };
	model.signature = signatureOf(model);
	return model;
}

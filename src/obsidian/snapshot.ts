import { getLinkpath, parseFrontMatterAliases, type App, type TFile } from 'obsidian';
import { folderOf } from '../core/paths';
import type { LinkSnapshot, RawLink } from '../core/types';

function fileLink(app: App, file: TFile, firstOffset: number | null): RawLink {
	const cache = app.metadataCache.getFileCache(file);
	return {
		path: file.path,
		linkText: file.path,
		name: file.basename,
		folder: folderOf(file.path),
		aliases: parseFrontMatterAliases(cache?.frontmatter ?? null) ?? [],
		mtime: file.stat.mtime,
		firstOffset,
	};
}

function unresolvedKey(linkPath: string): string {
	return `?${linkPath.toLowerCase()}`;
}

/** First character offset of each destination in the target, for "order in note". */
function firstOffsets(app: App, target: TFile): Map<string, number> {
	const cache = app.metadataCache.getFileCache(target);
	const map = new Map<string, number>();
	const add = (link: string, offset: number): void => {
		const linkPath = getLinkpath(link);
		const dest = app.metadataCache.getFirstLinkpathDest(linkPath, target.path);
		const key = dest ? dest.path : unresolvedKey(linkPath);
		const prev = map.get(key);
		if (prev === undefined || offset < prev) map.set(key, offset);
	};
	// Frontmatter sits above the body and has no positions: negative offsets keep property order first.
	const fm = cache?.frontmatterLinks ?? [];
	fm.forEach((l, i) => add(l.link, i - fm.length));
	for (const l of cache?.links ?? []) add(l.link, l.position.start.offset);
	for (const l of cache?.embeds ?? []) add(l.link, l.position.start.offset);
	return map;
}

/** Reads everything the core needs about the target's links as plain data. */
export function takeSnapshot(app: App, target: TFile | null): LinkSnapshot {
	if (!target) return { target: null, outgoing: [], backlinks: [] };
	const { resolvedLinks, unresolvedLinks } = app.metadataCache;
	const offsets = firstOffsets(app, target);

	const outgoing: RawLink[] = [];
	for (const destPath of Object.keys(resolvedLinks[target.path] ?? {})) {
		const file = app.vault.getFileByPath(destPath);
		if (file && file.extension === 'md') outgoing.push(fileLink(app, file, offsets.get(file.path) ?? null));
	}
	for (const linkText of Object.keys(unresolvedLinks[target.path] ?? {})) {
		outgoing.push({
			path: null, linkText, name: '', folder: '', aliases: [], mtime: 0,
			firstOffset: offsets.get(unresolvedKey(getLinkpath(linkText))) ?? null,
		});
	}

	const backlinks: RawLink[] = [];
	for (const [sourcePath, dests] of Object.entries(resolvedLinks)) {
		if (sourcePath === target.path || dests[target.path] === undefined) continue;
		const file = app.vault.getFileByPath(sourcePath);
		if (file && file.extension === 'md') backlinks.push(fileLink(app, file, null));
	}

	return { target: { path: target.path, name: target.basename }, outgoing, backlinks };
}

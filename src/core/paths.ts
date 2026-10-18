/** File name without folders or the `.md` extension. */
export function baseName(path: string): string {
	const file = path.slice(path.lastIndexOf('/') + 1);
	return file.toLowerCase().endsWith('.md') ? file.slice(0, -3) : file;
}

/** Folder of a vault path; empty for the vault root. */
export function folderOf(path: string): string {
	const i = path.lastIndexOf('/');
	return i <= 0 ? '' : path.slice(0, i);
}

/** Extension of the last path segment, lower case, without the dot; empty if none. */
export function extensionOf(path: string): string {
	const file = path.slice(path.lastIndexOf('/') + 1);
	const dot = file.lastIndexOf('.');
	return dot <= 0 ? '' : file.slice(dot + 1).toLowerCase();
}

export interface ShortFolder {
	text: string;
	/** Index in the full path where the visible part starts. */
	offset: number;
}

const ELLIPSIS = '…/';

/**
 * Shortens a folder path from the start so the nearest folders stay visible
 * ("…/Client A/Notes"). CSS can only cut text at the end, hence code.
 */
export function shortenFolder(path: string, maxChars: number): ShortFolder {
	if (path.length <= maxChars) return { text: path, offset: 0 };
	const parts = path.split('/');
	let kept = parts.pop() ?? '';
	while (parts.length > 0) {
		const next = `${parts[parts.length - 1] ?? ''}/${kept}`;
		if (next.length + ELLIPSIS.length > maxChars) break;
		kept = next;
		parts.pop();
	}
	if (parts.length === 0) return { text: path, offset: 0 };
	return { text: ELLIPSIS + kept, offset: path.length - kept.length };
}

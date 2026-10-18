import type { Item, LinkSnapshot, RawLink } from '../../src/core/types';
import { baseName, folderOf } from '../../src/core/paths';

export function raw(path: string | null, extra: Partial<RawLink> = {}): RawLink {
	const p = path ?? '';
	return {
		path,
		linkText: extra.linkText ?? p,
		name: path ? baseName(path) : '',
		folder: path ? folderOf(path) : '',
		aliases: [],
		mtime: 0,
		firstOffset: null,
		...extra,
	};
}

export function snap(outgoing: RawLink[], backlinks: RawLink[] = []): LinkSnapshot {
	return { target: { path: 'Trip Plan.md', name: 'Trip Plan' }, outgoing, backlinks };
}

export function item(name: string, extra: Partial<Item> = {}): Item {
	return {
		key: `outgoing:${name}`, group: 'outgoing', path: `${name}.md`, name, folder: '',
		aliases: [], mtime: 0, firstOffset: null, unresolved: false, needsFolder: false, ...extra,
	};
}

export class FakeTimers {
	now = 0;
	private next = 1;
	private tasks = new Map<number, { at: number; fn: () => void }>();
	set = (fn: () => void, ms: number): number => {
		const id = this.next++;
		this.tasks.set(id, { at: this.now + ms, fn });
		return id;
	};
	clear = (id: number): void => {
		this.tasks.delete(id);
	};
	advance(ms: number): void {
		this.now += ms;
		for (const [id, t] of [...this.tasks]) {
			if (t.at <= this.now) {
				this.tasks.delete(id);
				t.fn();
			}
		}
	}
}

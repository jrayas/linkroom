export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function isNavKey(key: string): key is NavKey {
	return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key);
}

/**
 * Next focused index in reading order. `blocks` are the item counts of each grid
 * in display order (one per section, or one when headings are off); each grid
 * lays its items out in `columns` columns, and Up/Down cross between grids.
 */
export function nextIndex(blocks: readonly number[], columns: number, index: number, key: NavKey): number {
	const total = blocks.reduce((a, b) => a + b, 0);
	if (total === 0) return -1;
	const cols = Math.max(1, Math.floor(columns));
	const clamp = (i: number): number => Math.min(total - 1, Math.max(0, i));
	switch (key) {
		case 'Home':
			return 0;
		case 'End':
			return total - 1;
		case 'ArrowLeft':
			return clamp(index - 1);
		case 'ArrowRight':
			return clamp(index + 1);
	}
	// Build visual rows as lists of global indices.
	const rows: number[][] = [];
	let start = 0;
	for (const count of blocks) {
		for (let r = 0; r < count; r += cols) {
			const row: number[] = [];
			for (let c = 0; c < cols && r + c < count; c++) row.push(start + r + c);
			rows.push(row);
		}
		start += count;
	}
	const rowAt = rows.findIndex((row) => row.includes(index));
	if (rowAt === -1) return clamp(index);
	const col = rows[rowAt]?.indexOf(index) ?? 0;
	const targetRow = rows[key === 'ArrowUp' ? rowAt - 1 : rowAt + 1];
	if (!targetRow) return index;
	return targetRow[Math.min(col, targetRow.length - 1)] ?? index;
}

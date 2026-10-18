import { describe, expect, it } from 'vitest';
import { baseName, extensionOf, folderOf, shortenFolder } from '../../src/core/paths';

describe('paths', () => {
	it('gets base names', () => {
		expect(baseName('Travel/Hotel Booking.md')).toBe('Hotel Booking');
		expect(baseName('Root.MD')).toBe('Root');
		expect(baseName('Board.canvas')).toBe('Board.canvas');
	});
	it('gets folders, empty for root', () => {
		expect(folderOf('Travel/Admin/Visa.md')).toBe('Travel/Admin');
		expect(folderOf('Visa.md')).toBe('');
	});
	it('gets extensions', () => {
		expect(extensionOf('a/b.PNG')).toBe('png');
		expect(extensionOf('a.b/c')).toBe('');
		expect(extensionOf('.hidden')).toBe('');
	});
	it('keeps short paths', () => {
		expect(shortenFolder('Travel/Bookings', 40)).toEqual({ text: 'Travel/Bookings', offset: 0 });
	});
	it('shortens from the start, keeping the nearest folders', () => {
		const p = 'Clients/Client A/Projects/2026/Notes';
		const r = shortenFolder(p, 18);
		expect(r.text).toBe('…/2026/Notes');
		expect(p.slice(r.offset)).toBe('2026/Notes');
	});
	it('keeps the last folder even when it alone is too long', () => {
		expect(shortenFolder('A/VeryLongFolderNameHere', 6).text).toBe('…/VeryLongFolderNameHere');
		expect(shortenFolder('VeryLongFolderNameHere', 6).offset).toBe(0);
	});
});

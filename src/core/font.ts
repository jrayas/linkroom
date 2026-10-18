/**
 * Makes a custom font-family value safe to put in a CSS variable: no characters
 * that could end the declaration or open a block, balanced quotes, bounded length.
 */
export function sanitiseFontFamily(input: string): string {
	let s = input.replace(/[;{}<>\\\n\r\t]/g, '').trim().slice(0, 200);
	for (const q of ['"', "'"]) {
		if ((s.split(q).length - 1) % 2 !== 0) s = s.split(q).join('');
	}
	return s.replace(/^,+|,+$/g, '').trim();
}

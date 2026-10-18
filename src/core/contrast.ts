export interface Rgb { r: number; g: number; b: number }

function clampByte(n: number): number {
	return Math.min(255, Math.max(0, Math.round(n)));
}

function hslToRgb(h: number, s: number, l: number): Rgb {
	const hue = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] =
		hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
			: hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
	return { r: clampByte((r + m) * 255), g: clampByte((g + m) * 255), b: clampByte((b + m) * 255) };
}

/** Parses #rgb, #rrggbb(aa), rgb()/rgba() and hsl()/hsla(), comma or space separated. */
export function parseColour(input: string): Rgb | null {
	const s = input.trim().toLowerCase();
	const hex = /^#([0-9a-f]{3,8})$/.exec(s);
	if (hex) {
		const h = hex[1] ?? '';
		if (h.length === 3 || h.length === 4) {
			const d = (i: number): number => parseInt((h[i] ?? '0') + (h[i] ?? '0'), 16);
			return { r: d(0), g: d(1), b: d(2) };
		}
		if (h.length === 6 || h.length === 8) {
			const d = (i: number): number => parseInt(h.slice(i, i + 2), 16);
			return { r: d(0), g: d(2), b: d(4) };
		}
		return null;
	}
	const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
	if (!fn) return null;
	const parts = (fn[2] ?? '').split(/[\s,/]+/).filter((p) => p.length > 0);
	if (parts.length < 3) return null;
	const num = (p: string | undefined): number => parseFloat(p ?? '');
	if ((fn[1] ?? '').startsWith('rgb')) {
		const ch = (p: string | undefined): number => (p?.endsWith('%') ? num(p) * 2.55 : num(p));
		const rgb = { r: clampByte(ch(parts[0])), g: clampByte(ch(parts[1])), b: clampByte(ch(parts[2])) };
		return Number.isNaN(rgb.r + rgb.g + rgb.b) ? null : rgb;
	}
	const h = num(parts[0]);
	const sat = num(parts[1]) / 100;
	const light = num(parts[2]) / 100;
	if (Number.isNaN(h + sat + light)) return null;
	return hslToRgb(h, sat, light);
}

export function toHex(c: Rgb): string {
	const p = (n: number): string => clampByte(n).toString(16).padStart(2, '0');
	return `#${p(c.r)}${p(c.g)}${p(c.b)}`;
}

function channel(v: number): number {
	const x = v / 255;
	return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function luminance(c: Rgb): number {
	return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Whether a colour reaches `min` contrast against the page. Sky link style uses
 * 3 to 1 (D-48): Obsidian's own dark-theme link colour sits near 4 to 1, and
 * Obsidian uses it for every link. Unknown colours count as readable, so a
 * parsing gap never greys out every link.
 */
export function isReadableText(colour: string, background: string, min = 4.5): boolean {
	const a = parseColour(colour);
	const b = parseColour(background);
	if (!a || !b) return true;
	return contrastRatio(a, b) >= min;
}

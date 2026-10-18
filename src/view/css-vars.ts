import { isReadableText } from '../core/contrast';
import { sanitiseFontFamily } from '../core/font';
import { isHexColour, LINK_STYLES } from '../core/settings';
import type { Settings, ViewState } from '../core/types';

const FONT_FAMILY = {
	interface: 'var(--font-interface)',
	text: 'var(--font-text)',
	system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

const FONT_SIZE = {
	small: 'var(--font-ui-small, 13px)',
	medium: 'var(--font-ui-medium, 15px)',
	large: 'var(--font-ui-large, 18px)',
} as const;

const ROW_GAP = { compact: '0.5rem', comfortable: '0.9rem', spacious: '1.4rem' } as const;

function fontFamily(s: Settings): string {
	if (s.fontFamily !== 'custom') return FONT_FAMILY[s.fontFamily];
	const custom = sanitiseFontFamily(s.customFontFamily);
	return custom === '' ? FONT_FAMILY.interface : `${custom}, var(--font-interface)`;
}

function customColour(s: Settings): string | null {
	return s.linkColourMode === 'custom' && isHexColour(s.customLinkColour) ? s.customLinkColour : null;
}

/** Settings become CSS variables and classes on the root, so styles.css stays declarative. */
export function applyAppearance(root: HTMLElement, s: Settings, vs: ViewState): void {
	root.setCssProps({
		'--lr-columns': vs.columns === 'auto' ? '1' : vs.columns,
		'--lr-font-family': fontFamily(s),
		'--lr-font-size': FONT_SIZE[s.fontSize],
		'--lr-link': customColour(s) ?? 'var(--interactive-accent)',
		// Names coloured as links use Obsidian's own link text colour in theme mode (D-48).
		'--lr-link-text': customColour(s) ?? 'var(--text-accent, var(--interactive-accent))',
		'--lr-underline-thickness': s.underlineThickness === 'thin' ? '1px' : '2px',
		'--lr-row-gap': ROW_GAP[s.rowSpacing],
		'--lr-max-lines': s.wrapLongNames ? String(s.maxWrapLines) : '1',
	});
	for (const c of ['1', '2', '3', '4', 'auto']) root.toggleClass(`lr-cols-${c}`, vs.columns === c);
	for (const style of LINK_STYLES) root.toggleClass(`lr-style-${style}`, s.linkStyle === style);
	root.toggleClass('lr-wrap', s.wrapLongNames);
	root.toggleClass('lr-folder-same', s.folderPathStyle === 'same');
	updateContrast(root);
}

/**
 * Reads the resolved link and page colours from hidden probes (always `rgb(...)`,
 * whatever the theme wrote). A link colour too pale to read as text marks the
 * root, and Sky link style then uses the normal text colour for names.
 */
export function updateContrast(root: HTMLElement): void {
	const link = root.querySelector('.lr-probe-link');
	const bg = root.querySelector('.lr-probe-bg');
	if (!(link instanceof HTMLElement) || !(bg instanceof HTMLElement)) return;
	const win = root.win;
	root.toggleClass('lr-link-pale', !isReadableText(win.getComputedStyle(link).color, win.getComputedStyle(bg).color, 3));
}

/** The theme accent as #rrggbb, for pre-filling the custom colour (04-settings). */
export function resolvedAccentHex(doc: Document, toHex: (c: string) => string | null): string | null {
	const probe = doc.body.createSpan({ cls: 'lr-probe lr-probe-theme-accent' });
	try {
		return toHex(doc.defaultView?.getComputedStyle(probe).color ?? '');
	} finally {
		probe.remove();
	}
}

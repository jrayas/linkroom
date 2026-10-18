import type { GroupKind, LinkStyle, SortMode } from '../core/types';

/** All UI text in one place (02-ui-design, D-24). */
export const COPY = {
	tabTitle: 'Linkroom',
	command: 'Open linked notes',
	noNote: 'Open a note to see its links.',
	noLinks: 'This note has no links yet.',
	allOff: 'Turn on a group in the view options to see links.',
	unresolved: "This note doesn't exist yet.",
	viewOptions: 'View options',
	searchPlaceholder: 'Search notes',
	clearSearch: 'Clear search',
	heading: { both: 'Both ways', outgoing: 'Outgoing', backlinks: 'Backlinks' } satisfies Record<GroupKind, string>,
	// Both ways never shows an empty message: an empty Both ways group is left out (D-42).
	sectionEmpty: { both: '', outgoing: 'No outgoing links.', backlinks: 'No notes link here yet.' } satisfies Record<GroupKind, string>,
	linkStyle: { hairline: 'Hairline', apple: 'Sky link', tile: 'Soft tile' } satisfies Record<LinkStyle, string>,
	sort: {
		az: 'Alphabetical',
		za: 'Reverse alphabetical',
		modified: 'Recently modified',
		appearance: 'Order in note',
	} satisfies Record<SortMode, string>,
};

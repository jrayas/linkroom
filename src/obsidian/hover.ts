import type { App, HoverParent } from 'obsidian';

export const HOVER_SOURCE = 'linkroom';

/** The `hover-link` payload is not in the typings; this mirrors what core plugins send. */
interface HoverLinkPayload {
	event: MouseEvent;
	source: string;
	hoverParent: HoverParent;
	targetEl: HTMLElement;
	linktext: string;
	sourcePath: string;
}

export function triggerHover(app: App, payload: Omit<HoverLinkPayload, 'source'>): void {
	app.workspace.trigger('hover-link', { ...payload, source: HOVER_SOURCE });
}

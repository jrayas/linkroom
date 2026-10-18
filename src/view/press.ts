import type { Component } from 'obsidian';

/** Hold time and allowed drift for a touch long-press. */
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

export interface PressHooks {
	itemAt(e: Event): number | null;
	/** Shows the item's menu; false when the item has none (unresolved). */
	showMenu(index: number, at: MouseEvent | { x: number; y: number }): boolean;
	click(e: MouseEvent, index: number): void;
}

/**
 * Clicks and context menus on items, on every platform: right-click, Android's
 * long-press `contextmenu`, and a long-press timer for iOS, which fires none.
 * One menu per press, and the click that ends a long-press is swallowed so it
 * neither closes the menu nor opens the note.
 */
export class ItemPress {
	private swallowClick = false;
	private press: { timer: number; x: number; y: number; shown: boolean } | null = null;

	constructor(owner: Component, body: HTMLElement, private hooks: PressHooks) {
		owner.registerDomEvent(body, 'pointerdown', () => {
			this.swallowClick = false;
		});
		owner.registerDomEvent(body, 'click', (e) => {
			if (this.swallowClick) {
				this.swallowClick = false;
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			const i = this.hooks.itemAt(e);
			if (i !== null) this.hooks.click(e, i);
		});
		owner.registerDomEvent(body, 'contextmenu', (e) => this.onContextMenu(e));
		owner.registerDomEvent(body, 'touchstart', (e) => this.onTouchStart(e), { passive: true });
		owner.registerDomEvent(body, 'touchmove', (e) => this.onTouchMove(e), { passive: true });
		owner.registerDomEvent(body, 'touchend', (e) => this.onTouchEnd(e), { passive: false });
		owner.registerDomEvent(body, 'touchcancel', () => this.cancel(), { passive: true });
	}

	cancel(): void {
		if (this.press) window.clearTimeout(this.press.timer);
		this.press = null;
	}

	private onContextMenu(e: MouseEvent): void {
		const i = this.hooks.itemAt(e);
		if (i === null) return;
		e.preventDefault();
		if (this.press?.shown) return;
		if (this.press) {
			window.clearTimeout(this.press.timer);
			this.press.shown = true;
		}
		if (this.hooks.showMenu(i, e)) this.swallowClick = true;
	}

	private onTouchStart(e: TouchEvent): void {
		this.cancel();
		const touch = e.touches[0];
		const i = this.hooks.itemAt(e);
		if (e.touches.length !== 1 || !touch || i === null) return;
		const press = { x: touch.clientX, y: touch.clientY, shown: false, timer: 0 };
		press.timer = window.setTimeout(() => {
			press.shown = true;
			if (this.hooks.showMenu(i, { x: press.x, y: press.y })) this.swallowClick = true;
		}, LONG_PRESS_MS);
		this.press = press;
	}

	private onTouchMove(e: TouchEvent): void {
		const touch = e.touches[0];
		const press = this.press;
		if (!press || press.shown || !touch) return;
		if (Math.abs(touch.clientX - press.x) > LONG_PRESS_SLOP || Math.abs(touch.clientY - press.y) > LONG_PRESS_SLOP) this.cancel();
	}

	private onTouchEnd(e: TouchEvent): void {
		// Without this the browser sends mousedown and click, which close the menu and open the note.
		if (this.press?.shown && this.swallowClick && e.cancelable) e.preventDefault();
		this.cancel();
	}
}

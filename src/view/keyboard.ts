/** Roving tabindex: exactly one item is in the tab order; arrow keys move it (05-behaviour). */
export class RovingFocus {
	private els: HTMLElement[] = [];
	index = 0;

	reset(els: HTMLElement[], index: number): void {
		this.els = els;
		this.index = 0;
		this.set(index);
	}

	set(index: number): void {
		const prev = this.els[this.index];
		if (prev) prev.tabIndex = -1;
		this.index = Math.max(0, Math.min(index, this.els.length - 1));
		const next = this.els[this.index];
		if (next) next.tabIndex = 0;
	}

	focus(index: number): void {
		this.set(index);
		this.els[this.index]?.focus();
	}
}

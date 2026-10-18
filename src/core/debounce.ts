export interface Timers {
	set: (fn: () => void, ms: number) => number;
	clear: (id: number) => void;
}

export interface Debounced {
	call: () => void;
	cancel: () => void;
	/** Runs the pending call now, if there is one. */
	flush: () => void;
	pending: () => boolean;
}

/** Timers are passed in so core stays free of `window` and tests can use fake ones. */
export function debounce(fn: () => void, ms: number, timers: Timers): Debounced {
	let id: number | null = null;
	const cancel = (): void => {
		if (id !== null) timers.clear(id);
		id = null;
	};
	return {
		call: () => {
			cancel();
			id = timers.set(() => {
				id = null;
				fn();
			}, ms);
		},
		cancel,
		flush: () => {
			if (id === null) return;
			cancel();
			fn();
		},
		pending: () => id !== null,
	};
}

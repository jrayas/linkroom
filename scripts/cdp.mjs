// Minimal Chrome DevTools Protocol client (Node 22: global fetch and WebSocket).
export const PORT = Number(process.env.LR_CDP_PORT ?? 9222);

export async function targets() {
	const res = await fetch(`http://127.0.0.1:${PORT}/json`);
	return res.json();
}

export async function pickTarget(window = 'main') {
	const pages = (await targets()).filter((t) => t.type === 'page');
	// The Settings window is its own page with an about:blank URL.
	const t = window === 'settings'
		? pages.find((x) => x.title.startsWith('Settings'))
		: pages.find((x) => x.url.startsWith('app://') && !x.title.startsWith('Settings'));
	if (!t) throw new Error(`No ${window} window found`);
	return t;
}

export async function connect(window = 'main') {
	const t = await pickTarget(window);
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
	let id = 0;
	const pending = new Map();
	const events = [];
	ws.onmessage = (m) => {
		const msg = JSON.parse(m.data);
		if (msg.id && pending.has(msg.id)) {
			pending.get(msg.id)(msg);
			pending.delete(msg.id);
		} else if (msg.method) events.push(msg);
	};
	const send = (method, params = {}) => new Promise((ok) => {
		const n = ++id;
		pending.set(n, ok);
		ws.send(JSON.stringify({ id: n, method, params }));
	});
	const evaluate = async (expression) => {
		const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
		if (r.result?.exceptionDetails) {
			const d = r.result.exceptionDetails;
			throw new Error(d.exception?.description ?? d.text);
		}
		return r.result?.result?.value;
	};
	return { ws, send, evaluate, events, close: () => ws.close() };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// https://github.com/sindresorhus/is-plain-obj

function isPlainObject(value) {
	
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

async function fetch2(url, options = {}) {

	// if we have passed a body property and it is a plain object or array,
	// create the object serialized as json and set the appropriate  content-type header

	if (Array.isArray(options.body) || isPlainObject(options.body)) {
		options.body = JSON.stringify(options.body);
		options.headers = { 'content-type': 'application/json', ...options.headers };
	}

	// use another the fetch wrapper, if given; this is the case when fetch2 is called 
	// from in +page.js or +page.server.js files, where sveltekit gives was a fetch wrapper;
	// https://kit.svelte.dev/docs/web-standards#fetch-apis

	let fetch = options.fetch;

	if (fetch == null) {
		let browserFetchIsAvailable = (typeof window === 'object' && typeof window.fetch === 'function');

		if (browserFetchIsAvailable) {
			fetch = window.fetch;	
		}
	}

	if (fetch == null) {
		throw new Error('fetch is missing')
	}

	let timerId;

	if (options.signal == null && typeof AbortController === 'function') {
		let abortController = new AbortController();
		options.signal = abortController.signal;

		// "When abort() is called, the fetch() promise rejects with a DOMException named AbortError"
		// https://developer.mozilla.org/en-US/docs/Web/API/AbortController

		timerId = setTimeout(() => { abortController.abort() }, options.timeout || 5 * 1000);
	}

	let res = await fetch(url, options);
	clearTimeout(timerId);

	if (options.parse === false) {
		return res;
	}
 
	// if response is json, automatically return the parsed data

	if (res.headers.has('Content-Type') && res.headers.get('Content-Type').toLowerCase().startsWith('application/json')) {
		let payload = await res.json();
		let responseIsError = (res.ok === false && res.status >= 400);

		// note that for res.status in the 3xx range, we also have res.ok as false; but we don't
		// consider those to be an error (and it seems fetch will automatically make a new request in that case?)

		if (!responseIsError) {
			let message = 'response was not successful' + (payload.message != null ? (': ' + payload.message) : '');
			let err = new Error(message);
			err.payload = payload;

			throw err;
		}
		else {
			return payload;
		}
	}
	// if we need to handle the parsing of other content-types, do it here
	else {
		let message = `unexpected content-type in the response: ${res.headers.get('Content-Type')}`;
		let err = new Error(message);

		throw err;
	}
 
}

export default fetch2;
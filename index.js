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

	if (options.parse == null) {
		options.parse = {}
		options.parse.keysWithDates = ['created_at', 'updated_at'];
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

		timerId = setTimeout(() => { abortController.abort() }, options.timeout || 10 * 1000);
	}

	let res = await fetch(url, options);
	clearTimeout(timerId);

	if (options.parse === false) {
		return res;
	}
 
	// if response is json, automatically return the parsed data

	if (res.headers.has('Content-Type') && res.headers.get('Content-Type').toLowerCase().startsWith('application/json')) {
		let responseIsError = (res.ok === false && res.status >= 400);
		let payload = await res.json();
		// note that for res.status in the 3xx range, we also have res.ok as false; but we don't
		// consider those to be an error (and it seems fetch will automatically make a new request in that case?)

		if (responseIsError) {
			let message = (payload.message != null ? payload.message : 'response was not successful');
			let err = new Error(message);
			err.payload = payload;

			throw err;
		}
		else {
			if (typeof options.parse === 'object' && Array.isArray(options.parse.keysWithDates)) {
				parseDates(payload, options.parse.keysWithDates);
			}

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

function parseDates(payload, keysWithDates) {

	let array = isPlainObject(payload) ? [payload] : payload;

	for (let o of array) {
		if (!isPlainObject(o)) { continue }

		for (let [key, value] of Object.entries(o)) {
			let propertyIsDate = keysWithDates.includes(key) && typeof value === 'string';

			if (propertyIsDate) {
				try {
					o[key] = new Date(value);
				}
				catch(err) {
					// ...
				}
			}

			// recursive call

			if (isPlainObject(value) || Array.isArray(value)) {
				parseDates(value, keysWithDates);
			}
		}
	}
}

export default fetch2;

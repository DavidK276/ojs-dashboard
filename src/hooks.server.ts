import { type Handle, redirect } from "@sveltejs/kit";
import { API_URL } from "$lib/server/api";
import { base } from '$app/paths';

export const handle: Handle = async ({ event, resolve }) => {
	const { url, cookies } = event;
	if (url.pathname.startsWith(`${base}/login`) || url.pathname.startsWith(new URL(API_URL).pathname)) {
		return resolve(event);
	}
	const apiKey = cookies.get('ApiKey');
	if (apiKey == null) {
		redirect(302, `${base}/login`);
	}
	const response = await fetch(API_URL + 'users?count=1', {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});
	if (response.status !== 200) {
		cookies.delete('ApiKey', { path: '/' });
		redirect(302, `${base}/login`);
	}

	return resolve(event);
};
import { type Actions, fail } from "@sveltejs/kit";
import { API_URL } from "$lib/server/api";

export const actions = {
	default: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		if (!formData.has('apiKey')) {
			return fail(400);
		}
		const apiKey = formData.get('apiKey') as string;
		const response = await fetch(API_URL + 'users?count=1', {
			headers: {
				Authorization: `Bearer ${apiKey}`
			},
			redirect: "follow"
		});
		if (response.status !== 200) {
			console.log('Login failed with status ' + response.status);
			return { success: false }
		}
		const expiry = new Date();
		expiry.setDate(expiry.getDate() + 7);
		cookies.set('ApiKey', apiKey, {
			path: '/',
			httpOnly: true,
			expires: expiry
		});
		return { success: true };
	}
} satisfies Actions;
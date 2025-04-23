import { type Handle, redirect } from "@sveltejs/kit";
import { API_URL } from "$lib/server/api";

export const handle: Handle = async ({ event, resolve }) => {
    const { url, cookies } = event;
    if (url.pathname.startsWith('/login')) {
        return resolve(event);
    }
    const apiKey = cookies.get('ApiKey');
    if (apiKey == null) {
        redirect(302, '/login');
    }
    const response = await fetch(API_URL + 'users?count=1', {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
    if (response.status !== 200) {
        redirect(302, '/login');
    }

    return resolve(event);
};
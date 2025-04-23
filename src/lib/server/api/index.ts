import { env } from "$env/dynamic/private";

if (!env.OJS_API_URL) {
	throw new Error('OJS_API_URL is not set');
}

export const API_URL = env.OJS_API_URL;
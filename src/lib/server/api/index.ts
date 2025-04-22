import { env } from "$env/dynamic/private";

export const API_URL = env.OJS_API_URL || "http://localhost:8081/index.php/meicogsci/api/v1/";
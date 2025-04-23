import { page } from "$app/state";
import type { State } from '@vincjo/datatables/server'
import { goto } from "$app/navigation";

export class SSRFilters {
	Filters = $derived(page.url)

	constructor() {
		// console.log("Filters", this.Filters);
	}

	get(name: string) {
		return this.Filters.searchParams.get(name);
	}

	async update(filters: Record<string, string>) {
		const url = new URL(this.Filters);
		Object.entries(filters).forEach(([name, value]) => {
			if (value) {
				url.searchParams.set(name, value);
			}
			else {
				url.searchParams.delete(name);
			}
		});

		if (typeof window !== "undefined") {
			await goto(url, { keepFocus: true });
		}
	}

	async fromState(s: State) {
		const filters = s.filters ?? [];
		const sort = s.sort;
		const page = s.currentPage;
		const rowsPerPage = s.rowsPerPage;

		const url = new URL(this.Filters);
		// add filters from state to search params
		for (const { field, value } of filters) {
			// @ts-expect-error call to string anyway
			url.searchParams.set(field.toString(), value.toString());
		}

		// remove filters not in state from search params
		for (const [field, value] of url.searchParams) {
			if (!field.startsWith('_') && !filters.some(filter => filter.field === field)) {
				url.searchParams.delete(field);
			}
		}

		if (sort?.field && sort?.direction) {
			url.searchParams.set("_sort_id", sort.field?.toString());
			url.searchParams.set("_sort_direction", sort.direction);
		}
		if (page) {
			url.searchParams.set("_page", page.toString());
		}
		if (rowsPerPage) {
			url.searchParams.set("_pageSize", rowsPerPage.toString());
		}

		if (typeof window !== "undefined") {
			await goto(url, { keepFocus: true });
		}
	}

	async clearFilters() {
		const url = new URL(this.Filters);
		for (const [key, value] of url.searchParams.entries()) {
			if (!key.startsWith('_')) {
				url.searchParams.delete(key);
			}
		}

		if (typeof window !== "undefined") {
			await goto(url, { keepFocus: true });
		}
	}

	async clear(...params: string[]) {
		const url = new URL(this.Filters);
		params.forEach((p) => url.searchParams.delete(p));

		if (typeof window !== "undefined") {
			await goto(url, { keepFocus: true });
		}
	}

	isFiltered(...params: string[]) {
		return (
				params.length > 0 && params.some((p) => this.Filters.searchParams.has(p))
		);
	}
}
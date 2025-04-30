<script lang="ts">
	import {
		Datatable,
		Pagination,
		RowsPerPage,
		type State,
		TableHandler,
		Th,
		ThFilter,
		ThSort
	} from '@vincjo/datatables/server';
	import { TableHandler as ClientTableHandler } from '@vincjo/datatables';
	import type { PageData } from './$types';
	import { deserialize } from '$app/forms';
	import { SSRFilters } from "./params.svelte";
	import { parse } from "csv-parse/browser/esm";
	import { stringify } from "csv-stringify/browser/esm/sync";
	import { mount } from "svelte";
	import NoticeModal from "$lib/components/NoticeModal.svelte";
	import { storable } from "$lib/storable";
	import { type CsvRow, downloadCSV, getRowColor, isAffiliationValid, isUniversityEmail } from "./utils";
	import type { ActionResult } from "@sveltejs/kit";
	import { invalidateAll } from "$app/navigation";
	import ConfirmDeleteModal from "$lib/components/ConfirmDeleteModal.svelte";
	import { get } from "svelte/store";


	const { data }: { data: PageData } = $props();
	const table = new TableHandler(data.users, { rowsPerPage: 20, totalRows: data.count, selectBy: 'id' });
	let tableIsAllSelected = $state(false);
	const rowCount = $derived(table.rowCount);
	const spValidEmail = storable('spValidEmail', false);
	const spValidAf = storable('spValidAf', false);
	const filters = new SSRFilters();

	table.load(async (state: State) => {
		await filters.fromState(state);
		table.totalRows = data.count;
		if (table.currentPage > 1) {
			const numPages = Math.ceil(data.count / table.rowsPerPage);
			console.log('numPages', numPages, table.currentPage);
			if (numPages < table.currentPage) {
				table.setPage(1);
				state.currentPage = 1;
				await filters.fromState(state);
			}
		}
		return data.users;
	});

	let csvFormat = $state("givenName,familyName,email,affiliation,comments");
	let useFirstCsvRow = $state(true);

	let goodRows = storable('goodRows', new Array<CsvRow>());
	const goodRecordsTable = $derived(new ClientTableHandler($goodRows, {
		rowsPerPage: Number.MAX_VALUE,
		selectBy: 'email'
	}));
	const goodRowCount = $derived(goodRecordsTable.rowCount);
	let goodOutputColumns = storable('goodOutputColumns', 'givenName,familyName,email,affiliation,comments');

	let badRows = storable('badRows', new Array<CsvRow>());
	const badRecordsTable = $derived(new ClientTableHandler($badRows, {
		rowsPerPage: Number.MAX_VALUE,
		selectBy: 'email'
	}));
	const badRowCount = $derived(badRecordsTable.rowCount);
	let badOutputColumns = storable('badOutputColumns', get(goodOutputColumns) + ',issues');

	let checkMissingFn = storable('checkMissingFn', false);
	let checkMissingEmail = storable('checkMissingEmail', false);
	let checkEmailRegistration = storable('checkEmailRegistration', false);
	let checkEmailValidDomain = storable('checkEmailValidDomain', false);
	let checkMissingAffiliation = storable('checkMissingAffiliation', false);
	let checkAffiliationValid = storable('checkAffiliationValid', false);

	function checkRow(csvRow: CsvRow) {
		const problems = [];
		if ($checkMissingFn && !csvRow.familyName) {
			problems.push("Missing family name");
		}
		if ($checkMissingEmail && !csvRow.email) {
			problems.push("Missing email");
		}
		else if ($checkEmailRegistration && csvRow.email && !data.emails.has(csvRow.email)) {
			problems.push("Email does not belong to a registered user");
		}
		else if ($checkEmailValidDomain && csvRow.email && !isUniversityEmail(csvRow.email)) {
			problems.push("Email is not a university email address");
		}
		if ($checkMissingAffiliation && !csvRow.affiliation) {
			problems.push("Missing affiliation");
		}
		else if ($checkAffiliationValid && csvRow.affiliation && !isAffiliationValid(csvRow.affiliation)) {
			problems.push("Unrecognized affiliation");
		}
		return { noProblems: problems.length === 0, problems: problems.join(', ') };
	}

	function clearCsvTables() {
		$badRows = [];
		$goodRows = [];
	}

	function selectFile() {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = 'text/csv';
		fileInput.onchange = async (event: Event) => {
			const input = event.target as HTMLInputElement;
			if (!input.files) {
				return;
			}
			clearCsvTables();

			const goodRowsTmp: CsvRow[] = [];
			const badRowsTmp: CsvRow[] = [];
			const parser = parse({
				columns: useFirstCsvRow || csvFormat.split(','),
			});
			parser.on("readable", () => {
				let record: CsvRow;
				while ((record = parser.read()) !== null) {
					const { noProblems, problems } = checkRow(record);
					if (noProblems) {
						goodRowsTmp.push(record);
					}
					else {
						record.issues = problems;
						badRowsTmp.push(record);
					}
				}
			});
			parser.on("error", (err: Error) => {
				mount(NoticeModal, {
					target: document.body,
					props: { headerText: "Error while parsing CSV", bodyText: err.message, show: true }
				});
			});
			const csv = await input.files[0].text();
			parser.write(csv);
			parser.end();
			$goodRows = goodRowsTmp;
			$badRows = badRowsTmp;
		};
		fileInput.click();
	}

	async function resetTable() {
		await filters.clearFilters();
		await filters.clear('_spValidAf', '_spValidEmail');
		table.clearFilters();
		table.clearSelection();
		$spValidAf = false;
		$spValidEmail = false;
	}

	async function deleteUsers() {
		const formData = new FormData();
		formData.set('searchParams', filters.Filters.searchParams.toString());
		if (tableIsAllSelected) {
			formData.set('selectAll', 'true');
		}
		else {
			const userIdsToDelete = table.selected as bigint[];
			formData.set('userIds', userIdsToDelete.join(','));
		}
		const deleteCount = tableIsAllSelected ? table.rowCount.total : table.selected.length;

		const response = await fetch('?/del', { method: 'POST', body: formData });
		const result: ActionResult = deserialize(await response.text());
		if (result.type === 'success') {
			await invalidateAll();
			await resetTable();
			mount(NoticeModal, {
				target: document.body,
				props: {
					headerText: "Finished",
					bodyText: `Successfully deleted ${deleteCount} user${deleteCount > 1 ? 's' : ''}`,
					show: true
				}
			});
		}
		else if (result.type === 'failure' && result.data) {
			mount(NoticeModal, {
				target: document.body,
				props: { headerText: "Error deleting users", bodyText: result.data.message, show: true }
			});
		}
	}

	async function exportUsers() {
		const formData = new FormData();
		formData.set('searchParams', filters.Filters.searchParams.toString());
		if (tableIsAllSelected) {
			formData.set('selectAll', 'true');
		}
		else {
			const userIdsToDelete = table.selected as bigint[];
			formData.set('userIds', userIdsToDelete.join(','));
		}

		const response = await fetch('?/exportUsers', { method: 'POST', body: formData });
		const result: ActionResult = deserialize(await response.text());
		if (result.type === 'success' && result.data) {
			downloadCSV(`participants-${new Date().toISOString()}.csv`, result.data.csv);
		}
		else if (result.type === 'failure' && result.data) {
			mount(NoticeModal, {
				target: document.body,
				props: {
					headerText: "Error exporting users",
					bodyText: "Please try again or contact administrator",
					show: true
				}
			});
		}
	}
</script>

<h1 class="text-2xl font-bold">Registered participants</h1>
<Datatable {table}>
	{#snippet header()}
		<div class="row ver-center" style="gap: 0">
			<div class="row ver-center">
				<label for="notUniEmail">Not a university email</label>
				<input id="notUniEmail" type="checkbox" bind:checked={$spValidEmail} onchange={async () => {
					await filters.update({_spValidEmail: Number($spValidEmail).toString()});
					table.invalidate();
				}}>
				<label for="invalidAf">Affiliation not recognized</label>
				<input id="invalidAf" type="checkbox" bind:checked={$spValidAf} onchange={async () => {
					await filters.update({_spValidAf: Number($spValidAf).toString()});
					table.invalidate();
				}}>
			</div>
		</div>
		<RowsPerPage {table}/>
	{/snippet}
	<table>
		<thead>
		<tr>
			<Th>
				<div class="row ver-center" style="white-space: nowrap; gap: 0"><input bind:checked={tableIsAllSelected}
				                                                                       style="margin-right: var(--xs)"
				                                                                       type="checkbox"><span>Select&nbsp;all</span>
				</div>
			</Th>
			<ThSort field="id" {table}>User ID</ThSort>
			<ThSort field="givenName" {table}>Given Name</ThSort>
			<ThSort field="familyName" {table}>Family Name</ThSort>
			<ThSort field="email" {table}>Email</ThSort>
			<ThSort field="affiliation" {table}>Affiliation</ThSort>
			<ThSort field="dateRegistered" {table}>Date of registration</ThSort>
			<ThSort field="dateMostRecentAssignment" {table}>Date of most recent submission</ThSort>
			<Th>Belongs to groups</Th>
			<Th>Has previously<br>reviewed</Th>
		</tr>
		<tr>
			<Th></Th>
			<Th><!-- id column --></Th>
			<ThFilter field="givenName" {table}></ThFilter>
			<ThFilter field="familyName" {table}></ThFilter>
			<ThFilter field="email" {table}></ThFilter>
			<ThFilter field="affiliation" {table}></ThFilter>
			<ThFilter field="dateRegistered" {table}></ThFilter>
			<ThFilter field="dateMostRecentAssignment" {table}></ThFilter>
			<ThFilter field="groups" {table}></ThFilter>
			<Th><!-- Delete button column --></Th>
		</tr>
		</thead>
		<tbody>
		{#each table.rows as row, index (index)}
			<tr style="background: {getRowColor(row)}">
				<td>
					<div class="row ver-center" style="white-space: nowrap; gap: 0"><input style="margin-right: var(--xs)"
					                                                                       type="checkbox"
					                                                                       checked={table.selected.includes(row.id)}
					                                                                       onchange={() => table.select(row.id)}><span>Select</span>
					</div>
				</td>
				<td>{row.id}</td>
				<td>{row.givenName}</td>
				<td>{row.familyName}</td>
				<td>{row.email}</td>
				<td>{row.affiliation}</td>
				<td>{row.dateRegistered}</td>
				<td>{row.dateMostRecentAssignment}</td>
				<td>{row.groups}</td>
				<td><input type="checkbox" readonly disabled checked={row.hasReviewAssignment}></td>
			</tr>
		{/each}
		</tbody>
	</table>
	{#snippet footer()}
		{@const selectedUserCount = tableIsAllSelected ? table.rowCount.total : table.selected.length}
		<div class="col" style="width: 100%; gap: 0">
			<div class="row ver-center" style="justify-content: space-between">
				<div><p>Showing {rowCount.start}-{rowCount.end} of {rowCount.total} rows</p></div>
				<Pagination {table}/>
			</div>
			<div class="row ver-center">
				<button type="button" style="cursor: pointer"
				        onclick={async () => {await resetTable()}}>Clear filters
				</button>
				<button type="button" style="cursor: pointer"
				        class:hidden={!selectedUserCount}
				        onclick={exportUsers}>{`Export ${selectedUserCount} user${selectedUserCount > 1 ? 's' : ''} as CSV`}
				</button>
				<button type="button" style="cursor: pointer; background: var(--danger)"
				        class:hidden={!selectedUserCount}
				        onclick={() => mount(ConfirmDeleteModal, {target: document.body, props: {userCount: selectedUserCount, callback: deleteUsers}})}>{`Delete ${selectedUserCount} user${selectedUserCount > 1 ? 's' : ''}`}
				</button>
			</div>
		</div>
	{/snippet}
</Datatable>

<h1 class="text-2xl font-bold">CSV import/export</h1>
<div class="col">
	<Datatable basic table={badRecordsTable}>
		{#snippet header()}
			<div class="col" style="gap: 0; width: 100%">
				<div class="col" style="gap: 0">
					<h3 class="font-bold text-lg">Checks to perform</h3>
					<div class="row ver-center">
						<label for="missingFn">Missing family name</label>
						<input id="missingFn" type="checkbox" bind:checked={$checkMissingFn}>
						<label for="missingEmail">Missing email</label>
						<input id="missingEmail" type="checkbox" bind:checked={$checkMissingEmail}>
						<label for="notRegistered">Email does not belong to a registered user</label>
						<input id="notRegistered" type="checkbox" bind:checked={$checkEmailRegistration}>
						<label for="notUniEmail">Not a university email</label>
						<input id="notUniEmail" type="checkbox" bind:checked={$checkEmailValidDomain}>
						<label for="missingAf">Missing affiliation</label>
						<input id="missingAf" type="checkbox" bind:checked={$checkMissingAffiliation}>
						<label for="invalidAf">Affiliation not recognized</label>
						<input id="invalidAf" type="checkbox" bind:checked={$checkAffiliationValid}>
					</div>
				</div>
				<div class="col" style="gap: 0; width: 25%">
					<h3 class="font-bold text-lg">Format of CSV</h3>
					<div class="row ver-center">
						<label for="useCsvFirstRow">Get columns from first row of CSV</label>
						<input id="useCsvFirstRow" type="checkbox" bind:checked={useFirstCsvRow}>
					</div>
					<label for="csvFormat">Columns</label>
					<div class="row ver-center" style="margin-bottom: var(--sm)">
						<input id="csvFormat" type="text" bind:value={csvFormat} disabled={useFirstCsvRow}>
						<button type="button" style="cursor: pointer" onclick={selectFile}>Import CSV</button>
						<button type="button" style="cursor: pointer" onclick={clearCsvTables}>Clear tables</button>
					</div>
				</div>
				<h2 class="text-xl font-bold">Rows with issues</h2>
			</div>
		{/snippet}
		<table>
			<thead>
			<tr>
				<Th>
					<div class="row ver-center" style="white-space: nowrap; gap: 0"><input checked={badRecordsTable.isAllSelected}
					                                                                       onchange={() => badRecordsTable.selectAll()}
					                                                                       style="margin-right: var(--xs)"
					                                                                       type="checkbox"><span>Select&nbsp;all</span>
					</div>
				</Th>
				<ThSort field="givenName" table={badRecordsTable}>Given Name</ThSort>
				<ThSort field="familyName" table={badRecordsTable}>Family Name</ThSort>
				<ThSort field="email" table={badRecordsTable}>Email</ThSort>
				<ThSort field="affiliation" table={badRecordsTable}>Affiliation</ThSort>
				<ThSort field="comments" table={badRecordsTable}>Comments</ThSort>
				<Th>Issues</Th>
			</tr>
			<tr>
				<Th></Th>
				<ThFilter field="givenName" table={badRecordsTable}></ThFilter>
				<ThFilter field="familyName" table={badRecordsTable}></ThFilter>
				<ThFilter field="email" table={badRecordsTable}></ThFilter>
				<ThFilter field="affiliation" table={badRecordsTable}></ThFilter>
				<ThFilter field="comments" table={badRecordsTable}></ThFilter>
				<Th></Th>
			</tr>
			</thead>
			<tbody>
			{#each badRecordsTable.rows as row, index (index)}
				<tr style="background: orange">
					<td>
						<div class="row ver-center" style="white-space: nowrap; gap: 0"><input style="margin-right: var(--xs)"
						                                                                       type="checkbox"
						                                                                       checked={badRecordsTable.selected.includes(row.email)}
						                                                                       onchange={() => badRecordsTable.select(row.email)}><span>Select</span>
						</div>
					</td>
					<td>{row.givenName}</td>
					<td>{row.familyName}</td>
					<td>{row.email}</td>
					<td>{row.affiliation}</td>
					<td>{row.comments}</td>
					<td>{row.issues}</td>
				</tr>
			{/each}
			</tbody>
		</table>
		{#snippet footer()}
			{@const exportSize = badRowCount.selected || badRowCount.total}
			<div class="row ver-bottom" style="padding: var(--sm); width: 50%">
				<div class="col" style="gap: 0; width: 50%">
					<label for="outputCsvColumns1">Output columns</label>
					<input id="outputCsvColumns1" type="text" bind:value={$badOutputColumns}>
				</div>
				<button type="button"
				        class:hidden={$badOutputColumns === 'givenName,familyName,email,affiliation,comments,issues'}
				        onclick={() => $badOutputColumns = 'givenName,familyName,email,affiliation,comments,issues'}>
					Reset
				</button>
				<button type="button" style="cursor: pointer" class:hidden={badRecordsTable.rowCount.total === 0}
				        onclick={() => {
                            const resultRows = badRowCount.selected ? badRecordsTable.getSelectedRows() : badRecordsTable.rows.concat();
                            const csv = stringify(resultRows, {columns: $badOutputColumns.split(','), header: true});
                            downloadCSV(`participant_issues-${new Date().toISOString()}.csv`, csv);
                        }}>
					Export {exportSize} row{exportSize > 1 ? 's' : ''} as CSV
				</button>
			</div>
		{/snippet}
	</Datatable>
	<Datatable basic table={goodRecordsTable}>
		{#snippet header()}
			<div style="width: 25%">
				<h2 class="text-xl font-bold">Rows with no issues</h2>
			</div>
		{/snippet}
		<table>
			<thead>
			<tr>
				<Th>
					<div class="row ver-center" style="white-space: nowrap; gap: 0"><input
							checked={goodRecordsTable.isAllSelected}
							onchange={() => goodRecordsTable.selectAll()}
							style="margin-right: var(--xs)"
							type="checkbox"><span>Select&nbsp;all</span>
					</div>
				</Th>
				<ThSort field="givenName" table={goodRecordsTable}>Given Name</ThSort>
				<ThSort field="familyName" table={goodRecordsTable}>Family Name</ThSort>
				<ThSort field="email" table={goodRecordsTable}>Email</ThSort>
				<ThSort field="affiliation" table={goodRecordsTable}>Affiliation</ThSort>
				<ThSort field="comments" table={goodRecordsTable}>Comments</ThSort>
			</tr>
			<tr>
				<Th></Th>
				<ThFilter field="givenName" table={goodRecordsTable}></ThFilter>
				<ThFilter field="familyName" table={goodRecordsTable}></ThFilter>
				<ThFilter field="email" table={goodRecordsTable}></ThFilter>
				<ThFilter field="affiliation" table={goodRecordsTable}></ThFilter>
				<ThFilter field="comments" table={goodRecordsTable}></ThFilter>
			</tr>
			</thead>
			<tbody>
			{#each goodRecordsTable.rows as row, index (index)}
				<tr style="background: limegreen">
					<td>
						<div class="row ver-center" style="white-space: nowrap; gap: 0"><input style="margin-right: var(--xs)"
						                                                                       type="checkbox"
						                                                                       checked={goodRecordsTable.selected.includes(row.email)}
						                                                                       onchange={() => goodRecordsTable.select(row.email)}><span>Select</span>
						</div>
					</td>
					<td>{row.givenName}</td>
					<td>{row.familyName}</td>
					<td>{row.email}</td>
					<td>{row.affiliation}</td>
					<td>{row.comments}</td>
				</tr>
			{/each}
			</tbody>
		</table>
		{#snippet footer()}
			{@const exportSize = goodRowCount.selected || goodRowCount.total}
			<div class="row ver-bottom" style="padding: var(--sm); width: 50%">
				<div class="col" style="gap: 0; width: 50%">
					<label for="outputCsvColumns2">Output columns</label>
					<input id="outputCsvColumns2" type="text" bind:value={$goodOutputColumns}>
				</div>
				<button type="button"
				        class:hidden={$goodOutputColumns === 'givenName,familyName,email,affiliation,comments'}
				        onclick={() => $goodOutputColumns = 'givenName,familyName,email,affiliation,comments'}>Reset
				</button>
				<button type="button" style="cursor: pointer" class:hidden={goodRecordsTable.rowCount.total === 0}
				        onclick={() => {
                            const resultRows = goodRowCount.selected ? goodRecordsTable.getSelectedRows() : goodRecordsTable.rows.concat();
                            const csv = stringify(resultRows, {columns: $goodOutputColumns.split(','), header: true});
                            downloadCSV(`participants-${new Date().toISOString()}.csv`, csv);
                        }}>
					Export {exportSize} row{exportSize > 1 ? 's' : ''} as CSV
				</button>
			</div>
		{/snippet}
	</Datatable>
</div>
import type { PageServerLoad } from "./$types";
import { groupSettings, reviewAssignments, stageAssignments, users, userSettings } from "$lib/server/db/schema";
import { db } from "$lib/server/db";
import {
	and,
	asc,
	type Column,
	desc,
	eq,
	getTableColumns,
	inArray,
	isNotNull,
	isNull,
	like,
	not,
	or,
	type SQL,
	sql
} from "drizzle-orm";
import { type Actions, fail } from "@sveltejs/kit"
import { stringify } from 'csv-stringify/sync';
import { VALID_EMAIL_DOMAINS, VALID_UNIVERSITY_LIST } from "./utils";

const givenNames = db.$with('gn').as(
		db.select({
			userId: userSettings.userId,
			givenName: userSettings.settingValue
		}).from(userSettings).where(sql`(${userSettings.settingName} = "givenName" AND ${userSettings.locale} = "en")`)
);
const familyNames = db.$with('fn').as(
		db.select({
			userId: userSettings.userId,
			familyName: userSettings.settingValue
		}).from(userSettings).where(sql`(${userSettings.settingName} = "familyName" AND ${userSettings.locale} = "en")`)
);
const affiliations = db.$with('a').as(
		db.select({
			userId: userSettings.userId,
			affiliation: userSettings.settingValue
		}).from(userSettings).where(sql`(${userSettings.settingName} = "affiliation" AND ${userSettings.locale} = "en")`)
);
const groupNames = db.$with('g').as(
		db.select({
			groupId: groupSettings.groupId,
			name: groupSettings.settingValue
		}).from(groupSettings).where(sql`(${groupSettings.settingName} = "name" AND ${groupSettings.locale} = "en")`)
);
const groups = db.$with('ug').as(
		db.with(groupNames).select({
			userId: stageAssignments.userId,
			groups: sql`(GROUP_CONCAT( DISTINCT ${groupNames.name} SEPARATOR ", "))`.as('groups')
		}).from(stageAssignments).leftJoin(groupNames, eq(groupNames.groupId, stageAssignments.groupId)).groupBy(stageAssignments.userId)
);
const mostRecentAssignments = db.$with('mra').as(
		db.select({
			userId: stageAssignments.userId,
			mostRecentAssignment: sql`(MAX ( ${stageAssignments.dateAssigned}))`.as('mostRecentAssignment')
		}).from(stageAssignments).groupBy(stageAssignments.userId)
);

function likeOrNull(column: Column | SQL.Aliased | SQL, value: string) {
	value = value.toLowerCase();
	if (value.startsWith("!") || value.startsWith("~")) {
		value = value.substring(1);
		if (value === 'null' || value === 'none' || value === 'nil' || value === 'blank') {
			return isNotNull(column);
		}
		return not(like(column, `%${value}%`));
	}
	if (value === 'null' || value === 'none' || value === 'nil' || value === 'blank') {
		return or(isNull(column), like(column, ""));
	}
	return like(column, `%${value}%`);
}

function parseSearchParams(searchParams: URLSearchParams) {
	const page = parseInt(searchParams.get("_page") || '1');
	const pageSize = parseInt(searchParams.get("_pageSize") || '20');
	const sortId = searchParams.get("_sort_id") || 'id';
	const sortDirection = searchParams.get("_sort_direction") || 'desc';

	let order: SQL | null = null;
	const f = (sortDirection === 'asc') ? asc : desc;
	// @ts-expect-error dynamically get column
	if (users[sortId] != null) {
		// @ts-expect-error dynamically get column
		order = f(users[sortId]);
	}
	else if (sortId === 'familyName') {
		order = f(familyNames.familyName);
	}
	else if (sortId === 'givenName') {
		order = f(givenNames.givenName);
	}
	else if (sortId === 'affiliation') {
		order = f(affiliations.affiliation);
	}
	else if (sortId === 'dateMostRecentAssignment') {
		order = f(mostRecentAssignments.mostRecentAssignment);
	}

	const filters: (SQL | undefined)[] = [];
	const givenNameFilter = searchParams.get("givenName");
	if (givenNameFilter != null) {
		filters.push(likeOrNull(givenNames.givenName, givenNameFilter));
	}

	const familyNameFilter = searchParams.get("familyName");
	if (familyNameFilter != null) {
		filters.push(likeOrNull(familyNames.familyName, familyNameFilter));
	}

	const affiliationFilter = searchParams.get("affiliation");
	if (affiliationFilter != null) {
		filters.push(likeOrNull(affiliations.affiliation, affiliationFilter));
	}
	if (searchParams.get("_spValidAf") === '1') {
		const validAfFilters = VALID_UNIVERSITY_LIST.map(af => not(eq(affiliations.affiliation, af)));
		filters.push(and(...validAfFilters));
	}

	const emailFilter = searchParams.get("email");
	if (emailFilter != null) {
		filters.push(likeOrNull(users.email, emailFilter));
	}
	if (searchParams.get("_spValidEmail") === '1') {
		const validEmailFilters = VALID_EMAIL_DOMAINS.map(emailDomain => not(like(users.email, '%' + emailDomain)));
		filters.push(and(...validEmailFilters));
	}

	const countryFilter = searchParams.get("country");
	if (countryFilter != null) {
		filters.push(likeOrNull(users.country, countryFilter));
	}

	const registrationFilter = searchParams.get("dateRegistered");
	if (registrationFilter != null) {
		filters.push(likeOrNull(users.dateRegistered, registrationFilter));
	}

	const validationFilter = searchParams.get("dateValidated");
	if (validationFilter != null) {
		filters.push(likeOrNull(users.dateValidated, validationFilter));
	}

	const groupsFilter = searchParams.get("groups");
	if (groupsFilter != null) {
		filters.push(likeOrNull(groups.groups, groupsFilter));
	}

	const dateMostRecentAssignmentFilter = searchParams.get("dateMostRecentAssignment");
	if (dateMostRecentAssignmentFilter != null) {
		filters.push(likeOrNull(mostRecentAssignments.mostRecentAssignment, dateMostRecentAssignmentFilter));
	}

	const limit = pageSize;
	const offset = (page - 1) * pageSize;

	return { limit, offset, order: order as SQL, filters };
}

export const load: PageServerLoad = async ({ url }) => {
	const { limit, offset, order, filters } = parseSearchParams(url.searchParams);
	const usersResult =
			await db.with(givenNames, familyNames, affiliations, groups, mostRecentAssignments).select({
				...getTableColumns(users),
				dateRegistered: sql<string>`(DATE_FORMAT(${users.dateRegistered}, "%e. %c. %Y %k:%i"))`,
				dateValidated: sql<string>`(DATE_FORMAT(${users.dateValidated}, "%e. %c. %Y %k:%i"))`,
				dateMostRecentAssignment: sql<string>`(DATE_FORMAT(${mostRecentAssignments.mostRecentAssignment}, "%e. %c. %Y %k:%i"))`,
				givenName: givenNames.givenName,
				familyName: familyNames.familyName,
				affiliation: affiliations.affiliation,
				groups: groups.groups,
				hasReviewAssignment: sql<boolean>`(EXISTS ( SELECT ${reviewAssignments.reviewerId} FROM ${reviewAssignments} WHERE ${reviewAssignments.reviewerId} = ${users.id}))`,

			}).from(users)
					.leftJoin(givenNames, eq(givenNames.userId, users.id))
					.leftJoin(familyNames, eq(familyNames.userId, users.id))
					.leftJoin(affiliations, eq(affiliations.userId, users.id))
					.leftJoin(groups, eq(groups.userId, users.id))
					.leftJoin(mostRecentAssignments, eq(mostRecentAssignments.userId, users.id))
					.where(and(eq(users.disabled, false), ...filters))
					.orderBy(order)
					.limit(limit).offset(offset);

	const { count } = (await db.with(givenNames, familyNames, affiliations, groups, mostRecentAssignments).select({
				count: sql<number>`(count (*))`
			}).from(users)
					.leftJoin(givenNames, eq(givenNames.userId, users.id))
					.leftJoin(familyNames, eq(familyNames.userId, users.id))
					.leftJoin(affiliations, eq(affiliations.userId, users.id))
					.leftJoin(groups, eq(groups.userId, users.id))
					.leftJoin(mostRecentAssignments, eq(mostRecentAssignments.userId, users.id))
					.where(and(eq(users.disabled, false), ...filters))
	)[0];

	console.log();

	const emailsResult = await db.select({ email: users.email }).from(users).where(eq(users.disabled, false));
	const emails: Set<string> = new Set();
	emailsResult.forEach(row => emails.add(row.email));

	return { users: usersResult, count, emails };
}

export const actions = {
	exportUsers: async ({ request }) => {
		const formData = await request.formData();
		const { filters, order } = parseSearchParams(new URLSearchParams(formData.get('searchParams') as string));

		const query = db.with(givenNames, familyNames, affiliations, groups, mostRecentAssignments).select({
			id: users.id,
			givenName: givenNames.givenName,
			familyName: familyNames.familyName,
			email: users.email,
			affiliation: affiliations.affiliation,
			contry: users.country,
			dateRegistered: sql<string>`(DATE_FORMAT(${users.dateRegistered}, "%e. %c. %Y %k:%i"))`,
			dateValidated: sql<string>`(DATE_FORMAT(${users.dateValidated}, "%e. %c. %Y %k:%i"))`,
			dateMostRecentAssignment: sql<string>`(DATE_FORMAT(${mostRecentAssignments.mostRecentAssignment}, "%e. %c. %Y %k:%i"))`,
		}).from(users)
				.leftJoin(givenNames, eq(givenNames.userId, users.id))
				.leftJoin(familyNames, eq(familyNames.userId, users.id))
				.leftJoin(affiliations, eq(affiliations.userId, users.id))
				.leftJoin(groups, eq(groups.userId, users.id))
				.leftJoin(mostRecentAssignments, eq(mostRecentAssignments.userId, users.id));

		let usersResult;
		if (formData.get('selectAll')) {
			usersResult = await query
					.where(and(eq(users.disabled, false), ...filters))
					.orderBy(order);
		}
		else {
			const userIds = (formData.get('userIds') as string).split(',').map(id => BigInt(id));
			usersResult = await query
					.where(inArray(users.id, userIds))
					.orderBy(order);
		}

		const columns = Object.keys(usersResult[0]);
		const csv = stringify(usersResult, {
			columns,
			header: true,
			cast: { date: value => value.toLocaleDateString() + " " + value.toLocaleTimeString() }
		});
		return { csv };
	},
	del: async ({ request }) => {
		const formData = await request.formData();
		if (formData.get('selectAll')) {
			const { filters } = parseSearchParams(new URLSearchParams(formData.get('searchParams') as string));
			try {
				const idsToDelete = (await db.with(givenNames, familyNames, affiliations, groups, mostRecentAssignments).select({
					id: users.id
				}).from(users)
						.leftJoin(givenNames, eq(givenNames.userId, users.id))
						.leftJoin(familyNames, eq(familyNames.userId, users.id))
						.leftJoin(affiliations, eq(affiliations.userId, users.id))
						.leftJoin(groups, eq(groups.userId, users.id))
						.leftJoin(mostRecentAssignments, eq(mostRecentAssignments.userId, users.id))
						.where(and(eq(users.disabled, false), ...filters)))
						.map(row => row.id);
				await db.delete(reviewAssignments).where(inArray(reviewAssignments.reviewerId, idsToDelete));
				await db.delete(users).where(inArray(users.id, idsToDelete));
			} catch (error: any) {
				return fail(500, { message: error.message });
			}
			return {};
		}

		const userIds = (formData.get('userIds') as string).split(',').map(id => BigInt(id));
		try {
			await db.delete(reviewAssignments).where(inArray(reviewAssignments.reviewerId, userIds));
			await db.delete(users).where(inArray(users.id, userIds));
		} catch (error: any) {
			return fail(500, { message: error.message });
		}
		return {};
	}
} satisfies Actions;
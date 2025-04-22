import { bigint, boolean, date, mediumtext, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
    id: bigint('user_id', { mode: 'bigint' }).primaryKey().autoincrement(),
    username: varchar('username', { length: 32 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    email: varchar('email', { length: 32 }).notNull().unique(),
    url: varchar('url', { length: 2047 }),
    phone: varchar('phone', { length: 32 }),
    mailingAddress: varchar('mailing_address', { length: 255 }),
    billingAddress: varchar('billing_address', { length: 255 }),
    country: varchar('country', { length: 90 }),
    locales: varchar('locales', { length: 255 }).notNull().default('[]'),
    dateLastEmail: date('date_last_email'),
    dateRegistered: date('date_registered').notNull(),
    dateValidated: date('date_validated'),
    dateLastLogin: date('date_last_login'),
    mustChangePassword: boolean('must_change_password'),
    authId: bigint('auth_id', { mode: 'bigint' }),
    authStr: varchar('auth_str', { length: 255 }),
    disabled: boolean().notNull(),
    disabledReason: text('disabled_reason'),
    inlineHelp: boolean('inline_help'),
    gossip: text()
});

export const userSettings = mysqlTable('user_settings', {
    userSettingId: bigint('user_setting_id', { unsigned: true, mode: 'bigint' }).primaryKey().autoincrement(),
    userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id),
    locale: varchar('locale', { length: 14 }).notNull(),
    settingName: varchar('setting_name', { length: 255 }).notNull(),
    settingValue: mediumtext('setting_value')
});

export const groupSettings = mysqlTable('user_group_settings', {
    groupSettingId: bigint('user_group_setting_id', { unsigned: true, mode: 'bigint' }).primaryKey().autoincrement(),
    groupId: bigint('user_group_id', { mode: 'bigint' }).notNull(),
    locale: varchar('locale', { length: 14 }).notNull(),
    settingName: varchar('setting_name', { length: 255 }).notNull(),
    settingValue: mediumtext('setting_value')
});

export const reviewAssignments = mysqlTable('review_assignments', {
    id: bigint('review_id', { mode: 'bigint' }).primaryKey().autoincrement(),
    reviewerId: bigint('reviewer_id', { mode: 'bigint' }).notNull().references(() => users.id)
});

export const stageAssignments = mysqlTable('stage_assignments', {
    id: bigint('stage_assignment_id', { mode: 'bigint' }).primaryKey().autoincrement(),
    userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id),
    groupId: bigint('user_group_id', { mode: 'bigint' }).notNull(),
    dateAssigned: date('date_assigned').notNull()
});

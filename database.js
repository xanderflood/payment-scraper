const { Client } = require('pg');

async function _withConnection(action) {
	const db = new Client();
	await db.connect();

	return await action(db);
}

async function setupDB(dev) {
	return _withConnection(async db => {
		if (dev) await db.query(`DROP TABLE transactions CASCADE`);

		await db.query(`CREATE TABLE IF NOT EXISTS categories
			(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				name varchar UNIQUE,
				slug varchar UNIQUE
			)`);
		await db.query(`CREATE TABLE IF NOT EXISTS transactions
			(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			    short_id varchar UNIQUE GENERATED ALWAYS AS (substring(id::varchar, 0, 5)) STORED,

				-- protonmail fields
				proton_email_id varchar UNIQUE,
				source varchar NOT NULL,
				subject varchar NOT NULL,

				-- inferred fields
				institution varchar NOT NULL,
				transaction_date DATE NOT NULL,
				merchant varchar NOT NULL,
				amount_string varchar NOT NULL,
				amount numeric NOT NULL,
				notes varchar,

				-- manual fields
				processed BOOL DEFAULT FALSE,
				category_id UUID REFERENCES categories(id),
				additional_notes varchar
			)`);

		await db.query(`CREATE OR REPLACE VIEW overview
			AS SELECT
				EXTRACT(MONTH FROM transaction_date),
				category_id,
				sum(amount)
			FROM
				transactions
			GROUP BY (EXTRACT(MONTH FROM transaction_date), category_id)`);
		await db.query(`CREATE OR REPLACE VIEW unprocessed
			AS SELECT * FROM transactions WHERE (NOT processed)`);
		await db.query(`CREATE OR REPLACE VIEW broken
			AS SELECT * FROM transactions
			WHERE amount IS NULL`);
	});
};

async function getCategories() {
	return _withConnection(async db => {
		return (await db.query(`SELECT slug, name FROM categories`)).rows;
	})
}

async function getUnprocessedTransactions() {
	return _withConnection(async db => {
		return (await db.query(`SELECT short_id, amount, merchant FROM unprocessed`)).rows;
	})
}

async function addCategory(slug, name) {
	return _withConnection(async db => {
		await db.query(`
			INSERT INTO categories (slug, name)
			VALUES ($1, $2);`,
			[slug, name]);
	})
}

async function categorizeTransaction(shortID, catSlug, notes) {
	return _withConnection(async db => {
		return (await db.query(`
			WITH category as (
				SELECT * FROM categories
				WHERE slug = $1)

			UPDATE transactions
			SET category_id = (SELECT id FROM category),
				additional_notes = $2,
				processed = TRUE
			WHERE short_id = $3
			  AND processed = false
			RETURNING (SELECT name FROM category)`,
			[catSlug, notes, shortID])).rows[0].name;
	})
}

async function upsertTransaction(emailID, from, subject, inst, date, merchant, amountStr, amount, notes) {
	return _withConnection(async db => {
		return (await db.query(`
			INSERT INTO transactions (proton_email_id, source, subject, institution, transaction_date, merchant, amount_string, amount, notes)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO NOTHING
			RETURNING short_id;`,
			[emailID, from, subject, inst, date, merchant, amountStr, amount, notes])
		).rows[0].short_id;
	})
}


module.exports = {
	setupDB,
	getCategories,
	getUnprocessedTransactions,
	addCategory,
	categorizeTransaction,
	upsertTransaction,
}

const ProtonMail = require('protonmail-api');
const { Client } = require('pg');
const cheerio = require('cheerio');

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const Logger = require('node-json-logger');
const logger = new Logger({ level: 'error'});

class UnrecognizedEmailError extends Error {}

function parseFloatSafe(str) {
	return parseFloat(str.replace(/,/g, ""));
}

const CapitalOneTransactionEmailRegex = /As requested, we&rsquo;re notifying you that on (.*), at (.*), a pending\n\tauthorization or purchase in the amount of \$([\,\d]+(?:\.\d+|)) was placed/
function scrapeCapitalOneEmail(email, body) {
	const info = {
		institution: "Capital One",
	};

	if (email.subject.startsWith("A new transaction was charged")) {
		const matches = CapitalOneTransactionEmailRegex.exec(body);

		info.merchant = entities.decode(matches[2]);

		info.amount_string = entities.decode(matches[3]);
		info.deposit = true
		if (info.amount == NaN) info.amount = null;
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

const BOAAmountRegex = /Amount\: \$([\,\d]+(?:\.\d+|))/
const BOAChargeMerchantRegex = /Where\: (.*)/
const BOADDSourceRegex = /From\: (.*)/
function scrapeBankOfAmericaEmail(email, body) {
	const info = {
		institution: "Bank of America",
	};

	if (email.subject.startsWith("Credit card transaction exceeds alert limit you set")) {
		var matches   = BOAChargeMerchantRegex.exec(body);
		info.merchant = entities.decode(matches[1]);

		matches = BOAAmountRegex.exec(body);
		info.amount_string = entities.decode(matches[1]);
		info.deposit = true
		if (info.amount == NaN) info.amount = null;
	} else if (email.subject.startsWith("Receipt: Direct Deposit Received")) {
		var matches   = BOADDSourceRegex.exec(body);
		info.merchant = entities.decode(matches[1]);

		matches = BOAAmountRegex.exec(body);
		info.amount_string = entities.decode(matches[1]);
		if (info.amount == NaN) info.amount = null;
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

const VenmoPaymentOutPushSubjectRegex = /You paid (.*) \$([\,\d]+(?:\.\d+|))/
const VenmoPaymentOutPullSubjectRegex = /You completed (.*)s \$([\,\d]+(?:\.\d+|)) charge request/
const VenmoPaymentInSubjectRegex = /(.*) paid you \$([\,\d]+(?:\.\d+|))/
function scrapeVenmoEmail(email, body) {
	const info = {
		institution: "Venmo",
	};

	//use cheerio
	if (email.subject.startsWith("You paid")) {
		var matches   = VenmoPaymentOutPushSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
		if (info.amount == NaN) info.amount = null;
	} else if (email.subject.startsWith("You completed")) {
		var matches   = VenmoPaymentOutPullSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
		if (info.amount == NaN) info.amount = null;
	} else if (email.subject.includes("paid you")) {
		var matches   = VenmoPaymentInSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
		if (info.amount == NaN) info.amount = null;
	} else if (email.subject.includes("requests")) {
		// ignore
		return false
	} else {
		throw new UnrecognizedEmailError
	}

	const $ = cheerio.load(body);
	info.notes = $("td div p").text();

	return info
}

const CashAppPaymentOutPushSubjectRegex = /You paid (.*) \$([\,\d]+(?:\.\d+|)) for (.*)/
function scrapeCashAppEmail(email, body) {
	const info = {
		institution: "Cash App/Square",
	};

	if (email.subject.startsWith("You paid")) {
		var matches   = CashAppPaymentOutPushSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
		if (info.amount == NaN) info.amount = null;

		info.notes = matches[3]
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

function scrapeTransactionInfo(email, body) {
	const domain = email.from.email.split("@")[1];

	var info;
	switch(domain) {
	case "notification.capitalone.com":
		info = scrapeCapitalOneEmail(email, body);
		break;
	case "ealerts.bankofamerica.com":
		info = scrapeBankOfAmericaEmail(email, body);
		break;
	case "venmo.com":
		info = scrapeVenmoEmail(email, body);
		break;
	case "square.com":
		info = scrapeCashAppEmail(email, body);
		break;
	default:
		throw new UnrecognizedEmailError
	}

	if (!info) return false;

	info.transaction_date = email.time
	info.amount = parseFloatSafe(info.amount_string)
	if (info.deposit) info.amount = -info.amount
	return info
}

(async () => {
	const pm = await ProtonMail.connect({
		username: process.env["PROTONMAIL_USERNAME"],
		password: process.env["PROTONMAIL_PASSWORD"],
	});

	try {
		const db = new Client();

		try {
			const label = await pm.getLabelByName(process.env["PROTONMAIL_LABEL_NAME"]);
			var page = await pm.getEmails(label, 0);

			await db.connect();

			await db.query(`CREATE TABLE IF NOT EXISTS categories
				(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					name varchar UNIQUE
				)`);
			await db.query(`CREATE TABLE IF NOT EXISTS transactions
				(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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

			for (var pageNum = 0; page.length > 0; page = await pm.getEmails(label, ++pageNum)) {
				for (var i = page.length - 1; i >= 0; i--) {
					email = page[i]
					const body = await email.getBody();

					var info;
					try {
						info = scrapeTransactionInfo(email, body);
					} catch (e) {
						console.log(e)

						logger.error("unrecognized email", {
							subject: email.subject,
							from: email.from.email,
							url: "https://mail.protonmail.com/inbox/${email.id}",
							error: e.toString(),
							stack: e.stack,
						})
					}

					if (info) await db.query(`
						INSERT INTO transactions (proton_email_id, source, subject, institution, transaction_date, merchant, amount_string, amount, notes)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						ON CONFLICT (id) DO NOTHING;`,
						[email.id, email.from.email, email.subject, info.institution, info.transaction_date, info.merchant, info.amount_string, info.amount, info.notes]);

					await email.removeLabel(label);
				}
			}
		} finally {
			await db.end();
		}
	} finally {
		await pm.close();
	}
})()
	.then(() => console.log("Scanned."))
	.catch(e => console.log(e));

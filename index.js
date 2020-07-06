const ProtonMail = require('protonmail-api');
const { Client } = require('pg');

// TODO use this if it's useful for other ones
// const { JSDOM } = require("jsdom");

const CapitalOneTransactionEmailRegex = /As requested, we&rsquo;re notifying you that on (\d{2})&#x2F;(\d{2})&#x2F;(\d{4}), at (.*), a pending\n\tauthorization or purchase in the amount of \$(\d+\.\d+) was placed/
function scrapeCapitalOneEmail(email, body) {
	const info = {
		institution: "Capital One",
	};

	if (email.subject.startsWith("A new transaction was charged")) {
		const matches = CapitalOneTransactionEmailRegex.exec(body);

		info.transaction_date = `${matches[1]}-${matches[2]}-${matches[3]}`;
		info.merchant         = matches[4];
		info.amount_string    = matches[5];
		info.amount           = parseFloat(matches[5]);
	} else {
		// TODO error logging (with kibana alerts)
	}

	return info
}

function scrapeBankOfAmericaEmail(email, body) {
	const info = {
		institution: "Bank of America",
	};

	if (email.subject.startsWith("Credit card transaction exceeds alert limit you set")) {
		// TODO
	} else if (email.subject.startsWith("Receipt: Direct Deposit Received")) {
		// TODO
	} else {
		// TODO error logging (with kibana alerts)
	}

	return info
}

function scrapeVenmoEmail(email, body) {
	const info = {
		institution: "Venmo",
	};

	if (email.subject.startsWith("You paid")) {
		// TODO
	} if (email.subject.startsWith("You completed")) {
		// TODO
	} else if (email.subject.includes("paid you")) {
		// TODO
	} else {
		// TODO error logging (with kibana alerts)
	}

	return info
}

function scrapeCashAppEmail(email, body) {
	const info = {
		institution: "Cash App",
	};

	if (email.subject.startsWith("You paid")) {
		// TODO
	} if (email.subject.startsWith("You completed")) {
		// TODO
	} else if (email.subject.includes("paid you")) {
		// TODO
	} else {
		// TODO error logging (with kibana alerts)
	}

	return info
}

function scrapeUSBankEmail(email, body) {
	// TODO
}

function scrapeTransactionInfo(email, body) {
	const domain = email.from.email.split("@")[1];

	switch(domain) {
	case "notification.capitalone.com":
		return scrapeCapitalOneEmail(email, body);
	case "onlinebanking@ealerts.bankofamerica.com":
		return scrapeBankOfAmericaEmail(email, body);
	case "venmo.com":
		return scrapeVenmoEmail(email, body);
	default:
		// TODO error
	}

	return {}

	// TODO infer the following:
	// service:          //
	// amount:           //
	// merchant:         //
	// other_text:       //
	// transaction_date: //
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

			await db.connect();
			await db.query(`DROP TABLE IF EXISTS transactions`) // TODO remove
			await db.query(`CREATE TABLE IF NOT EXISTS categories
				(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					name varchar UNIQUE
				)`);
			await db.query(`CREATE TABLE IF NOT EXISTS transactions
				(	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

					-- protonmail fields
					proton_email_id varchar UNIQUE,
					source varchar,
					subject varchar,

					-- inferred fields
					-- transaction_date DATE NOT NULL TODO put back
					institution varchar,
					transaction_date DATE,
					merchant varchar,
					notes varchar,
					amount_string varchar,
					amount numeric,

					-- manual fields
					category_id UUID REFERENCES categories(id),
					additional_notes varchar
				)`);

			// TODO initialize the key views as well
			//   broken transactions
			//   unprocessed transactions
			//   rollups

			for (var pageNum = 0; ; pageNum++) {
				const page = await pm.getEmails(label, pageNum);
				if (!page.length) break;

				for (var i = page.length - 1; i >= 0; i--) {
					email = page[i]

					const body = await email.getBody();
					const info = scrapeTransactionInfo(email, body);
					console.log(scrapeTransactionInfo(email, body));

					await db.query(`INSERT
						INTO transactions (proton_email_id, source, subject, institution, transaction_date, merchant, amount_string, amount)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
						ON CONFLICT (id) DO NOTHING;`,
						[email.id, email.from.email, email.subject, info.institution, info.transaction_date, info.merchant, info.amount_string, info.amount]);

					// TODO put these back
					// await email.removeLabel(label);
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

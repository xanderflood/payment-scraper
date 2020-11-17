const ProtonMail = require('protonmail-api');
const cheerio = require('cheerio');
const Logger = require('node-json-logger');
const logger = new Logger();
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const {markdownv2: tgmd} = require('telegram-format');
var htmlToText = require('html-to-text');

class UnrecognizedEmailError extends Error {}

function parseDOM(str) {
	return cheerio.load(str, {
		normalizeWhitespace: true
	})
}

function parseFloatSafe(str) {
	return parseFloat(str.replace(/,/g, ""));
}

const CapitalOneTransactionEmailRegex = /As requested, we&rsquo;re notifying you that on (?:.*), at (.*), a pending\n\tauthorization or purchase in the amount of \$([\,\d]+(?:\.\d+|)) was placed/
function scrapeCapitalOneEmail(email, body) {
	const info = {
		institution: "Capital One",
	};

	if (email.subject.startsWith("A new transaction was charged")) {
		const matches = CapitalOneTransactionEmailRegex.exec(body);

		info.merchant = entities.decode(matches[1]);

		info.amount_string = entities.decode(matches[2]);
	} else if (email.subject.startsWith("Your payment has posted")) {
		// ignore
		return false
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
	} else if (email.subject.startsWith("Receipt: Direct Deposit Received")) {
		var matches   = BOADDSourceRegex.exec(body);
		info.merchant = entities.decode(matches[1]);

		matches = BOAAmountRegex.exec(body);
		info.amount_string = entities.decode(matches[1]);
		info.credit = true
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

const VenmoPaymentOutPushSubjectRegex = /You paid (.*) \$([\,\d]+(?:\.\d+|))/
const VenmoPaymentOutPullSubjectRegex = /You completed (.*)\'s \$([\,\d]+(?:\.\d+|)) charge request/
const VenmoPaymentInSubjectRegex = /(.*) paid you \$([\,\d]+(?:\.\d+|))/
function scrapeVenmoEmail(email, body) {
	const info = {
		institution: "Venmo",
	};

	if (email.subject.startsWith("You paid")) {
		var matches   = VenmoPaymentOutPushSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
	} else if (email.subject.startsWith("You completed")) {
		var matches   = VenmoPaymentOutPullSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
	} else if (email.subject.includes("paid you")) {
		var matches   = VenmoPaymentInSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];
		info.credit = true
	} else if (email.subject.startsWith("Your Venmo bank transfer")) {
		// ignore
		return false
	} else if (email.subject.startsWith("Your Venmo Support Request")) {
		// ignore
		return false
	} else if (email.subject.includes("requests")) {
		// ignore
		return false
	} else if (email.subject.startsWith("Request #")) {
		// ignore
		return false
	} else if (email.subject.startsWith("[Venmo] Re:")) {
		// ignore
		return false
	} else if (email.subject.startsWith("[Venmo] Your bank account")) {
		// ignore
		return false
	} else if (email.subject.endsWith("Transaction History")) {
		// ignore
		return false
	} else {
		throw new UnrecognizedEmailError
	}

	const $ = parseDOM(body);
	info.notes = $("td div p").text();

	return info
}

const CashAppPaymentOutPushSubjectRegex = /You paid (.*) \$([\,\d]+(?:\.\d+|)) for (.*)/
const CashAppPaymentOutSentPushSubjectRegex = /You sent \$([\,\d]+(?:\.\d+|)) to (.*) for (.*)/
function scrapeCashAppEmail(email, body) {
	const info = {
		institution: "Cash App/Square",
	};

	if (email.subject.startsWith("You paid")) {
		var matches   = CashAppPaymentOutPushSubjectRegex.exec(email.subject);
		info.merchant = matches[1];

		info.amount_string = matches[2];

		info.notes = matches[3]
	} else if (email.subject.startsWith("You sent")) {
		var matches   = CashAppPaymentOutSentPushSubjectRegex.exec(email.subject);
		info.merchant = matches[2];

		info.amount_string = matches[1];

		info.notes = matches[3]
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

const DeltaMerchantRegex = /;">\s*\((.*)\)\s*<\/p>/
function scrapeDeltaEmail(email, body) {
	const info = {
		institution: "Delta Community Credit Union",
	};

	if (email.subject.startsWith("You have")) {
		var matches   = DeltaMerchantRegex.exec(body);
		info.merchant = matches[1];
		if (email.subject.startsWith("You have incurred")) {
			info.amount_string = matches[2];
		} else if (email.subject.startsWith("You have received")) {
			info.amount_string = matches[2];
			info.credit = true
		} else {
			throw new UnrecognizedEmailError
		}
	} else if (email.subject.startsWith("Large Deposit Alert")) {
		// TODO should I be ignoring these? how do they differ from the others?
		return //ignore
	} else if (email.subject.startsWith("Large Withdrawal Alert")) {
		// TODO should I be ignoring these? how do they differ from the others?
		return //ignore
	} else {
		throw new UnrecognizedEmailError
	}

	return info
}

function scrapeTransactionInfo(email, body) {
	const domain = email.from.email.split("@")[1].toLowerCase();

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
	case "deltacommunitycu.com":
		info = scrapeDeltaEmail(email, body)
		break;
	default:
		throw new UnrecognizedEmailError
	}

	if (!info) return false;

	info.transaction_date = email.time
	info.amount = parseFloatSafe(info.amount_string)
	if (!info.credit) info.amount = -info.amount
	if (info.amount == NaN) info.amount = null;
	return info
}

async function scrapeOnce(
	pmUsername,
	pmPassword,
	pmLabelName,
	database,
	development,
) {
	let pm;

	try {
		try {
			pm = await ProtonMail.connect({
				username: pmUsername,
				password: pmPassword,
			});
		} catch (err) {
			logger.error("protonmail: failed to connect", err)
			throw err
		}

		let label;
		try {
			label = await pm.getLabelByName(pmLabelName);
		} catch (err) {
			logger.error(`protonmail: failed to get label \`${pmLabelName}\``, err)
			throw err
		}

		let page;
		try {
			page = await pm.getEmails(label, 0);
		} catch (err) {
			logger.error(`protonmail: failed get emails`, err)
			throw err
		}

		for (var pageNum = 0; page.length > 0; page = await pm.getEmails(label, ++pageNum)) {
			for (var i = page.length - 1; i >= 0; i--) {
				email = page[i]
				let body;
				try {
					body = await email.getBody();
				} catch (err) {
					logger.error(`protonmail: failed to get email body`, err)
					throw err
				}

				try {
					body = htmlToText.fromString(body);
				} catch (err) {
					logger.error(`protonmail: failed to clean email body`, err)
					throw err
				}

				var info;
				try {
					info = scrapeTransactionInfo(email, body);
				} catch (e) {
					emailURL = "https://mail.protonmail.com/inbox/${email.id}"
					logger.error("failed processing email", {
						subject: email.subject,
						from: email.from.email,
						url: emailURL,
						error: e.toString(),
						stack: e.stack,
					});

					logger.error(`Unrecognized email [\"${email.subject}\"](${emailURL}) from ${email.from.email}`);
					logger.error(`Telegramized: Unrecognized email [\"${tgmd.escape(email.subject)}\"](${emailURL}) from ${tgmd.escape(email.from.email)}`);
					continue;
				}

				if (info) {
					let tr;
					try {
						tr = await database.createTransaction({
							sourceSystem:    "protonmail",
							sourceSystemId:  email.id,
							sourceSystemMeta: {
								from: email.from.email,
								subject: email.subject,
								emailId: email.id,
							},

							transactionDate: info.transaction_date,
							institution:     info.institution,
							merchant:        info.merchant,
							amountString:    info.amount_string,
							amount:          info.amount,
							notes:           info.notes,
						});
					} catch (err) {
						logger.error(`protonmail: failed to save transaction`, err)
						throw err
					}

					if (!development) {
						// TODO this is a message that _should_ be sent to telegram, not the logs
						const notesStr = info.notes ? `\: "${tgmd.escape(info.notes)}"` : ""
						logger.error(`\`\[${tr.shortId}\]\` \$${tgmd.escape(info.amount_string)} \@ ${tgmd.escape(info.merchant)}${notesStr}`);
					}
				}

				if (!development) await email.removeLabel(label);
			}
		}
	} finally {
		await pm.close();
	}
}

module.exports = { scrapeOnce }

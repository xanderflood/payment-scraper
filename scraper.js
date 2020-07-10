const ProtonMail = require('protonmail-api');
const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('pg');

const cheerio = require('cheerio');

const Logger = require('node-json-logger');
const logger = new Logger();

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const database = require('./database');

const notificationChatID = process.env["TELEGRAM_BOT_API_CHAT_ID"];

const bot = require('./bot');
const {markdownv2: tgmd} = require('telegram-format');

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

	const $ = parseDOM(body);
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

async function scrapeOnce(
	pmUsername,
	pmPassword,
	pmLabelName,
	notificationChatID,
	dev,
) {
	const pm = await ProtonMail.connect({
		username: pmUsername,
		password: pmPassword,
	});

	try {
		const db = new Client();

		try {
			const label = await pm.getLabelByName(pmLabelName);
			var page = await pm.getEmails(label, 0);

			await db.connect();

			database.setupDB(dev);

			for (var pageNum = 0; page.length > 0; page = await pm.getEmails(label, ++pageNum)) {
				for (var i = page.length - 1; i >= 0; i--) {
					email = page[i]
					const body = await email.getBody();

					var info;
					try {
						info = scrapeTransactionInfo(email, body);
					} catch (e) {
						emailURL = "https://mail.protonmail.com/inbox/${email.id}"
						logger.error("unrecognized email", {
							subject: email.subject,
							from: email.from.email,
							url: emailURL,
							error: e.toString(),
							stack: e.stack,
						});

						if (!dev) bot.sendMDV2Message(notificationChatID, `Unrecognized email [\"${tgmd.escape(email.subject)}\"](${emailURL}) from ${tgmd.inspect(email.from.email)}`);
						continue;
					}

					if (info) {
						const shortID = await database.upsertTransaction(
							email.id, email.from.email, email.subject, info.institution, info.transaction_date, info.merchant, info.amount_string, info.amount, info.notes)

						if (!dev) {
							const notesStr = info.notes ? `\: "${tgmd.escape(info.notes)}"` : ""
							bot.sendMDV2Message(notificationChatID, `\`\[${shortID}\]\` \$${tgmd.escape(info.amount_string)} \@ ${tgmd.escape(info.merchant)}${notesStr}`);
						}
					}

					if (!dev) await email.removeLabel(label);
				}
			}
		} finally {
			await db.end();
		}
	} finally {
		await pm.close();
	}
}

function startLoop(interval) {
	const helper = () => {
		logger.info("scanning");

		scrapeOnce(
			process.env["PROTONMAIL_USERNAME"],
			process.env["PROTONMAIL_PASSWORD"],
			process.env["PROTONMAIL_LABEL_NAME"],
			notificationChatID,
			!!process.env["DEVELOPMENT"],
		)
			.then(() => logger.info("scan finished"))
			.catch(e => logger.error(`scan failed`, {
				error: e,
				stack: e.stack,
			}))
			.finally(() => setTimeout(helper, interval));
	};

	helper();
}

module.exports = { scrapeOnce, startLoop }

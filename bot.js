const TelegramBot = require('node-telegram-bot-api');

const Logger = require('node-json-logger');
const logger = new Logger({ level: 'error'});

process.env.NTBA_FIX_319 = 1;
const bot = new TelegramBot(process.env["TELEGRAM_BOT_API_TOKEN"], { polling: true });
const notificationChatID = process.env["TELEGRAM_BOT_API_CHAT_ID"];
bot.on("polling_error", e => logger.error(e, {
	error: e,
	stack: e.stack,
}));

const {markdownv2: tgmd} = require('telegram-format');

const database = require('./database');

function sendMDV2Message(chatID, text) {
	bot.sendMessage(chatID, text, {parse_mode: "MarkdownV2"});
}

function _handleBotError(action, e) {
	logger.error(`failed ${action}`, {
		error: e,
		stack: e.stack,
	});
	sendMDV2Message(notificationChatID, `Failed ${action}`);
}

function _handle(regex, description, handler) {
	bot.onText(regex, (...args) => {
		if (args[0].chat.id != notificationChatID) {
			return
		}

		handler(...args)
			.catch(e => _handleBotError(description, e))
	});
}

function start() {
	_handle(/\/start/, "starting", (msg) => {
		sendMDV2Message(msg.chat.id, tgmd.escape(`Welcome! Enter /help to get started.`));
	});

	_handle(/\/help/, "helping", (msg) => {
		sendMDV2Message(msg.chat.id, tgmd.escape(`Welcome!
/cats
 list categories
/addcat (slug) (full name)
 create a new category
/unproc
 list unprocessed transactions
/catize (trasaction) (category) [notes]
 categorize a transaction`
		));
	});

	_handle(/\/cats/, "listing categories", async (msg) => {
		const cats = await database.getCategories();

		var response = `${cats.length} categories:\n`;
		for (var i = cats.length - 1; i >= 0; i--) {
			response += `\`[${cats[i].slug}]\` ${cats[i].name}\n`;
		}
		sendMDV2Message(msg.chat.id, response);
	});

	_handle(/\/unproc/, "listing new transactions", async (msg) => {
		const trs = await database.getUnprocessedTransactions();

		var response = `${tgmd.escape(trs.length.toString())} unprocessed transactions:\n`;
		for (var i = trs.length - 1; i >= 0; i--) {
			response += `${tgmd.bold(tgmd.monospace(trs[i].short_id))} \$${tgmd.escape(trs[i].amount.toString())} \@ ${tgmd.escape(trs[i].merchant.toString())}\n`;
		}
		sendMDV2Message(msg.chat.id, response);
	});

	_handle(/\/addcat ([a-zA-Z]+) (.+)$/, "adding a new category", async (msg, match) => {
		const slug = match[1];
		const name = match[2];
		const cats = await database.addCategory(slug, name);

		sendMDV2Message(msg.chat.id, `Category "${name}" \`\[${slug}\]\``);
	});

	_handle(/\/catize ([a-zA-Z0-9]+) ([a-zA-Z]+)(?:| (.+))$/, "categorizing a transaction", async (msg, match) => {
		const trShortID = match[1];
		const catSlug = match[2];
		const notes = match[3];
		const catName = await database.categorizeTransaction(trShortID, catSlug, notes);

		sendMDV2Message(msg.chat.id, `Categorized transcation \`\[${trShortID}\]\` "${catName}" \`\[${catSlug}\]\`\\\.`);
	});
}

module.exports = { start, sendMDV2Message }

process.env.NTBA_FIX_319 = 1;
const TelegramBot = require('node-telegram-bot-api');

const Logger = require('node-json-logger');
const logger = new Logger({ level: 'error'});

const {markdownv2: tgmd} = require('telegram-format');

function Bot(apiToken, apiChatID, database) {
	const bot = new TelegramBot(apiToken, { polling: true });

	bot.on("polling_error", e => logger.error(e, {
		error: e,
		stack: e.stack,
	}));

	// helper functions
	const _sendMDV2Message = (text) => {
		bot.sendMessage(apiChatID, text, {parse_mode: "MarkdownV2"});
	}

	const _handleBotError = (action, e) => {
		logger.error(`failed ${action}`, {
			error: e,
			stack: (e ? e.stack : null),
		});
		_sendMDV2Message(bot, notificationChatID, `Failed ${action}`);
	}

	const _handle = (regex, description, handler) => {
		bot.onText(regex, (...args) => {
			if (args[0].chat.id != apiChatID) {
				_handleBotError(description, e)
				return
			}

			handler(...args)
				.catch(e => _handleBotError(description, e))
		});
	}

	// API
	this.start = () => {
		_handle(/\/start/, "starting", (msg) => {
			_sendMDV2Message(tgmd.escape(`Welcome! Enter /help to get started.`));
		});

		_handle(/\/help/, "helping", (msg) => {
			_sendMDV2Message(tgmd.escape(`Welcome!
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
			_sendMDV2Message(response);
		});

		_handle(/\/unproc/, "listing new transactions", async (msg) => {
			const trs = await database.getUnprocessedTransactions();

			var response = `${tgmd.escape(trs.length.toString())} unprocessed transactions:\n`;
			for (var i = trs.length - 1; i >= 0; i--) {
				response += `${tgmd.bold(tgmd.monospace(trs[i].short_id))} \$${tgmd.escape(trs[i].amount.toString())} \@ ${tgmd.escape(trs[i].merchant.toString())}\n`;
			}
			_sendMDV2Message(response);
		});

		_handle(/\/addcat ([a-zA-Z]+) (.+)$/, "adding a new category", async (msg, match) => {
			const slug = match[1];
			const name = match[2];
			const cats = await database.addCategory(slug, name);

			_sendMDV2Message(`Category "${name}" \`\[${slug}\]\``);
		});

		_handle(/\/catize ([a-zA-Z0-9]+) ([a-zA-Z]+)(?:| (.+))$/, "categorizing a transaction", async (msg, match) => {
			const trShortID = match[1];
			const catSlug = match[2];
			const notes = match[3];
			const catName = await database.categorizeTransaction(trShortID, catSlug, notes);

			_sendMDV2Message(`Categorized transcation \`\[${trShortID}\]\` "${catName}" \`\[${catSlug}\]\`\\\.`);
		});
	}
}

module.exports = { Bot }

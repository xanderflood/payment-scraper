process.env.NTBA_FIX_319 = 1;
const TelegramBot = require('node-telegram-bot-api');
const { markdownv2: tgmd } = require('telegram-format');
const Logger = require('node-json-logger');

const logger = new Logger();

function Bot(apiToken, apiChatID, database) {
  // helper functions
  const _logError = (e, message) =>
    logger.error(e, {
      error: e,
      stack: e.stack,
      message,
    });

  const _sendMDV2Message = async (text) => {
    try {
      await bot.sendMessage(apiChatID, text, { parse_mode: 'MarkdownV2' });
    } catch (e) {
      _logError(e);
    }
  };

  const _handleBotError = (action, e) => {
    logger.error(`failed ${action}`, {
      error: e,
      stack: e ? e.stack : null,
    });
    _sendMDV2Message(bot, apiChatID, `Failed ${action}`);
  };

  const _handle = (regex, description, handler) => {
    bot.onText(regex, (...args) => {
      logger.info(`handling ${regex}`);

      if (args[0].chat.id !== apiChatID) {
        _logError(description);
        return;
      }

      handler(...args)
        .then(() => {})
        .catch((e) => _handleBotError(description, e));
    });
  };

  // Setup
  const bot = new TelegramBot(apiToken, { polling: true });
  bot.on('polling_error', _logError);

  // API
  this.start = () => {
    _handle(/\/start/, 'starting', async () => {
      await _sendMDV2Message(
        tgmd.escape(`Welcome! Enter /help to get started.`),
      );
    });

    _handle(/\/help/, 'helping', async () => {
      await _sendMDV2Message(
        tgmd.escape(`Welcome!
/cats
 list categories
/addcat (slug) (full name)
 create a new category
/unproc
 list unprocessed transactions
/catize (trasaction) (category) [notes]
 categorize a transaction`),
      );
    });

    _handle(/\/cats/, 'listing categories', async () => {
      const cats = await database.getCategories();

      let response = `${cats.length} categories:\n`;
      for (let i = cats.length - 1; i >= 0; i--) {
        response += `\`[${tgmd.escape(cats[i].slug)}]\` ${tgmd.escape(
          cats[i].name,
        )}\n`;
      }
      await _sendMDV2Message(response);
    });

    _handle(/\/unproc/, 'listing new transactions', async () => {
      const trs = await database.getUnprocessedTransactions();

      let response = `${tgmd.escape(
        trs.length.toString(),
      )} unprocessed transactions:\n`;
      for (let i = trs.length - 1; i >= 0; i--) {
        response += `${tgmd.bold(
          tgmd.monospace(trs[i].shortId),
        )} $${tgmd.escape(trs[i].amount.toString())} @ ${tgmd.escape(
          trs[i].merchant.toString(),
        )}\n`;
      }
      await _sendMDV2Message(response);
    });

    _handle(
      /\/addcat ([a-zA-Z]+) (.+)$/,
      'adding a new category',
      async (msg, match) => {
        const slug = match[1];
        const name = match[2];
        await database.addCategory({ slug, name });

        await _sendMDV2Message(`Category "${name}" \`[${slug}]\``);
      },
    );

    _handle(
      /\/catize ([a-zA-Z0-9]+) ([a-zA-Z]+)(?:| (.+))$/,
      'categorizing a transaction',
      async (msg, match) => {
        const trShortID = match[1];
        const catSlug = match[2];
        const notes = match[3];
        const catName = await database.categorizeTransaction(
          trShortID,
          catSlug,
          notes,
        );

        await _sendMDV2Message(
          `Categorized transcation \`[${trShortID}]\` "${catName}" \`[${catSlug}]\`\\.`,
        );
      },
    );
  };
}

module.exports = { Bot };

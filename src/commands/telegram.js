const oclif = require('@oclif/command');
const Logger = require('node-json-logger');
const { Database } = require('../database');
const { Bot } = require('../telegram');

const logger = new Logger();

class TelegramCommand extends oclif.Command {
  async run() {
    const { flags } = this.parse(TelegramCommand);

    const database = new Database(flags.development);
    const bot = new Bot(flags.botAPIToken, flags.botAPIChatID, database);

    logger.info('starting telegram bot daemon...');
    bot.start();
  }
}

TelegramCommand.description = `Start the telegram bot
`;

TelegramCommand.flags = {
  botAPIToken: oclif.flags.string({
    char: 't',
    env: 'TELEGRAM_BOT_API_TOKEN',
    description: 'Telegram Bot API token',
    required: true,
  }),
  botAPIChatID: oclif.flags.string({
    char: 'c',
    env: 'TELEGRAM_BOT_API_CHAT_ID',
    description:
      'Telegram Bot API chat ID (TODO: cache these from a DB table by user ID instead)',
    required: true,
  }),
  development: oclif.flags.boolean({
    char: 'd',
    env: 'DEVELOPMENT',
    description: 'development mode',
    default: true,
  }),
};

module.exports = TelegramCommand;

const {Command, flags} = require('@oclif/command')
const {Database} = require ('../database');
const {Bot} = require('../telegram');

class TelegramCommand extends Command {
  async run() {
    const {flags} = this.parse(TelegramCommand)

    const database = new Database({ connectionString: flags.postgresConnection })
    const bot = new Bot(
      flags.botAPIToken,
      flags.botAPIChatID,
      database,
    )
  }
}

TelegramCommand.description = `Start the telegram bot
`

TelegramCommand.flags = {
  botAPIToken: flags.string({char: 't', env: "TELEGRAM_BOT_API_TOKEN", description: 'Telegram Bot API token', required: true}),
  botAPIChatID: flags.string({char: 'c', env: "TELEGRAM_BOT_API_CHAT_ID", description: 'Telegram Bot API chat ID (TODO: cache these from a DB table by user ID instead)', required: true}),
  postgresConnection: flags.string({char: 'p', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: true})
}

module.exports = TelegramCommand

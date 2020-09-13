const {Command, flags} = require('@oclif/command')
const {Database} = require ('../database');
const {scrapeAllUnprocessedEmailsFromAccount} = require('../protonmail');

class ProtonCommand extends Command {
  async run() {
    const {flags} = this.parse(ProtonCommand)

    const database = new Database({ connectionString: flags.postgresConnection })
    scrapeAllUnprocessedEmailsFromAccount(
      flags.username,
      flags.password,
      flags.labelName,
      database,
      flags.development);
  }
}

ProtonCommand.description = `Start the protonmail email scanning agent
`

ProtonCommand.flags = {
  username: flags.string({char: 'u', env: "PROTONMAIL_USERNAME", description: 'protonmail username', required: true}),
  password: flags.string({char: 'p', env: "PROTONMAIL_PASSWORD", description: 'protonmail password', required: true}),
  labelName: flags.string({char: 'l', env: "PROTONMAIL_LABEL_NAME", description: 'protonmail flag to identify unprocessed notifications', default: 'Unprocessed'}),
  postgresConnection: flags.string({char: 'c', env: "POSTGRES_CONNECTION_STRING", description: 'Postgres connection URI', required: true}),
  development: flags.boolean({char: 'd', env: "DEVELOPMENT", description: 'development mode', default: true}),
}

module.exports = ProtonCommand

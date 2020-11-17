const {StandardTransferIdentifiers} = require('./transfers');

class Processor {
	constructor(database) {
		this.transferIdentifiers = StandardTransferIdentifiers;
		this.database = database;
	}

	async initialize() {
		this.categorizers = await this.database.getRules();
	}

	async processTransaction(transaction) {
		let update = {};
		for (var i = this.transferIdentifiers.length - 1; i >= 0; i--) {
			if (this.transferIdentifiers[i](transaction)) {
				update.isTransfer = true;
				break;
			}
		}
		for (var i = this.categorizers.length - 1; i >= 0; i--) {
			var c = this.categorizers[i];
			var categoryId;
			if (categoryId = this.categorizers[i].apply(transaction)) {
				update.categoryId = categoryId;
				break;
			}
		}
		return update;
	}
}

module.exports = {Processor};

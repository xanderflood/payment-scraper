const { StandardTransferIdentifiers } = require('./transfers');

const numericEqualityThreshold = 0.01

function compile(rule) {
	return (transaction) => {
		var matched = false
		switch (rule.type) {
		case "regex":
			matched = !!(transaction[rule.field].match(new RegExp(rule.string), "i"));
		case "numeric":
			matched = Math.abs(rule.number - transaction[rule.field]) < numericEqualityThreshold;
		}

		return matched ? tranaction.categoryId : undefined;
	};
}

class Processor {
	constructor(database) {
		this.transferIdentifiers = StandardTransferIdentifiers;
		this.database = database;
	}

	async initialize() {
		this.categorizers = (await this.database.getRules()).map(compile);
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
			if (categoryId = this.categorizers[i](transaction)) {
				update.categoryId = categoryId;
				break;
			}
		}
		return update;
	}
}

module.exports = {Processor};

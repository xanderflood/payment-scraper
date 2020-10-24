/// boolean matchers ///
function matches(field, regex) {
	return (transaction) => !!transaction[field].match(regex);
}
function equals(field, val) {
	return (transaction) => transaction[field] == val;
}
function isEqualTo(val) {
	return (actual) => actual == val;
}
function startsWith(field, str) {
	return (transaction) => transaction[field].startsWith(str);
}
function isCSVSource(mode) {
	return matches("sourceSystem", new RegExp(`^csv\|${mode}$`));
}
function csvSourceEntry(i, matcher) {
	return (transaction) => matcher(transaction.sourceSystemMeta[i]);
}
function and(a, b) {
	return (transaction) => a(transaction) && b(transaction);
}

/// syntactic sugar for category matchers ///
class Categorizer {
	constructor(matcher) {
		this.matcher = matcher;
	}

	then(catId) {
		return (transaction) => {
			if (this.matcher(transaction)) return catId;
		};
	}
}
function eef(matcher) {
	return new Categorizer(matcher);
}

module.exports = {
	matches,
	equals,
	startsWith,
	isCSVSource,
	csvSourceEntry,
	and,
	isEqualTo,
	eef,
};

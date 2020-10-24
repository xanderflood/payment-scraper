const {matches, equals, isEqualTo, startsWith, isCSVSource, csvSourceEntry, and} = require('./utils');

const StandardTransferIdentifiers = [
	and(startsWith("merchant", "Square Inc DES:* Cash App")),
	and(startsWith("merchant", "VENMO DES:CASHOUT")),
	and(startsWith("merchant", "VENMO DES:PAYMENT")),

	and(isCSVSource("boaCredit"), equals("merchant", "PAYMENT - THANK YOU")),

	and(isCSVSource("boaBank"), startsWith("merchant", "OVERDRAFT PROTECTION TO")),
	and(isCSVSource("boaBank"), startsWith("merchant", "Online Banking transfer")),
	and(isCSVSource("boaBank"), matches("merchant", "BANK OF AMERICA CREDIT CARD Bill Payment")),
	and(isCSVSource("boaBank"), startsWith("merchant", "OVERDRAFT PROTECTION TO")),
	and(isCSVSource("boaBank"), startsWith("merchant", "OVERDRAFT PROTECTION FROM")),
	and(isCSVSource("boaBank"), startsWith("merchant", "CAPITAL ONE DES:CRCARDPMT")),

	and(isCSVSource("delta"), equals("notes", "Transfer")),
	and(isCSVSource("venmo"), csvSourceEntry(6, isEqualTo(""))),
	and(isCSVSource("cashApp"), csvSourceEntry(9, isEqualTo("TRANSFER SENT"))),
	and(isCSVSource("capitalOne"), csvSourceEntry(4, isEqualTo("Payment/Credit"))),
];

module.exports = {StandardTransferIdentifiers};

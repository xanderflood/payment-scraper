const { Transform } = require('stream');

const venmoHeader = [
  '',
  'ID',
  'Datetime',
  'Type',
  'Status',
  'Note',
  'From',
  'To',
  'Amount (total)',
  'Amount (fee)',
  'Funding Source',
  'Destination',
  'Beginning Balance',
  'Ending Balance',
  'Statement Period Venmo Fees',
  'Terminal Location',
  'Year to Date Venmo Fees',
  'Disclaimer',
];
const cashAppHeader = [
  'Transaction ID',
  'Date',
  'Transaction Type',
  'Currency',
  'Amount',
  'Fee',
  'Net Amount',
  'Asset Type',
  'Asset Price',
  'Asset Amount',
  'Status',
  'Notes',
  'Name of sender/receiver',
  'Account',
];
const boaCreditHeader = [
  'Posted Date',
  'Reference Number',
  'Payee',
  'Address',
  'Amount',
];
const capitalOneHeader = [
  'Transaction Date',
  'Posted Date',
  'Card No.',
  'Description',
  'Category',
  'Debit',
  'Credit',
];
const boaBankHeader = ['Description', '', 'Summary Amt.'];

class InvalidFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFormatError';
  }
}
class InvalidRowClassificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRowClassificationError';
  }
}
class UnrecognizedAdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnrecognizedAdapterError';
  }
}

function arrayEqual(a, b) {
  return a.length === b.length && a.every((u, i) => u === b[i]);
}

const adapterFactories = {
  boaCredit: () => ({
    classify: (row) => {
      if (row[2] === 'PAYMENT - THANK YOU') return 'transfer';
      if (row[2].startsWith('Square Inc DES:* Cash App')) return 'transfer';
      if (row[2].startsWith('VENMO DES:CASHOUT')) return 'transfer';
      if (row[2].startsWith('VENMO DES:PAYMENT')) return 'transfer';

      return 'regular';
    },
    id: (row) => row[1],
    amount: (row) => row[4],
    date: (row) => row[0],
    notes: () => '',
    merchant: (row) => row[2],
    institution: () => 'boa',
  }),
  boaBank: () => ({
    classify: (row) => {
      if (row[1].startsWith('OVERDRAFT PROTECTION TO')) return 'transfer';
      if (row[1].startsWith('Online Banking transfer')) return 'transfer';
      if (row[1] === 'BANK OF AMERICA CREDIT CARD Bill Payment')
        return 'transfer';
      if (row[1].startsWith('OVERDRAFT PROTECTION TO')) return 'transfer';
      if (row[1].startsWith('OVERDRAFT PROTECTION FROM')) return 'transfer';

      if (row[1].startsWith('CAPITAL ONE DES:CRCARDPMT')) return 'transfer';
      if (row[1].startsWith('Square Inc DES:* Cash App')) return 'transfer';
      if (row[1].startsWith('VENMO DES:CASHOUT')) return 'transfer';
      if (row[1].startsWith('VENMO DES:PAYMENT')) return 'transfer';

      return 'regular';
    },
    amount: (row) => row[2],
    date: (row) => row[0],
    notes: () => '',
    merchant: (row) => row[1],
    institution: () => 'boa',
    skipRows: 7,
  }),
  delta: () => ({
    classify: (row) => {
      if (row[2] === 'Transfer') return 'transfer';
      if (row[3] === 'VENMO') return 'transfer';

      return 'regular';
    },
    id: (row) => row[0],
    amount: (row) => {
      if (row[4].length !== 0) {
        return row[4];
      }
      return row[5];
    },
    date: (row) => row[1],
    notes: (row) => row[2],
    merchant: (row) => row[3],
    institution: () => 'delta',
    skipRows: 4,
  }),
  venmo: () => {
    let username = '';

    return {
      classify: (row) => {
        if (row[0]) {
          username = row[0];

          return 'skip';
        }
        if (row[1] === '') return 'skip';
        if (row[6] === '') return 'transfer';

        return 'regular';
      },
      id: (row) => row[1],
      amount: (row) => row[8],
      date: (row) => row[2],
      notes: (row) => row[5],
      merchant: (row) => {
        if (row[6].replace(/ /g, '-') === username) {
          return `Venmo - ${row[7]}`;
        }
        return `Venmo - ${row[6]}`;
      },
      institution: () => 'venmo',
      skipRows: 3,
    };
  },
  cashApp: () => ({
    classify: (row) => {
      if (row[9] === 'TRANSFER SENT') return 'transfer';

      return 'regular';
    },
    id: (row) => row[0],
    amount: (row) => row[6],
    date: (row) => row[1],
    merchant: (row) => `CashApp - ${row[12]}`,
    notes: (row) => row[11],
    institution: () => 'CashApp',
  }),
  capitalOne: () => ({
    classify: (row) => {
      if (row[4] === 'Payment/Credit') return 'transfer';
      if (row[3].startsWith('Square Inc DES:* Cash App')) return 'transfer';
      if (row[3].startsWith('VENMO DES:CASHOUT')) return 'transfer';
      if (row[3].startsWith('VENMO DES:PAYMENT')) return 'transfer';

      return 'regular';
    },
    amount: (row) => {
      if (row[5].length !== 0) {
        return `-${row[5]}`;
      }
      return row[6];
    },
    date: (row) => row[0],
    merchant: (row) => row[3],
    notes: () => '',
    institution: () => 'capitalone',
  }),
};

function checkHeaderPatterns(possibleHeaderRow) {
  if (arrayEqual(possibleHeaderRow, boaCreditHeader)) return 'boaCredit';
  if (arrayEqual(possibleHeaderRow, boaBankHeader)) return 'boaBank';
  if (arrayEqual(possibleHeaderRow, venmoHeader)) return 'venmo';
  if (arrayEqual(possibleHeaderRow, cashAppHeader)) return 'cashApp';
  if (arrayEqual(possibleHeaderRow, capitalOneHeader)) return 'capitalOne';
  if (
    possibleHeaderRow[0] &&
    possibleHeaderRow[0].startsWith('Account Name : ')
  )
    return 'delta';

  return '';
}

function normalizeDate(date) {
  const d = new Date(Date.parse(date));
  if (
    Number.isNaN(d.getMonth()) ||
    Number.isNaN(d.getDate()) ||
    Number.isNaN(d.getYear())
  )
    throw new Error(`failed to normalize date string: "${date}"`);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function normalizeAmount(amount) {
  const cleaned = amount.replace(/[$\s,]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value))
    throw new Error(`failed to normalize dollar amount string: "${cleaned}"`);
  return value;
}

class TransactionParser extends Transform {
  constructor(options) {
    super({ objectMode: true });

    if (options) {
      if (typeof options.mode === 'string') {
        this.mode = options.mode;
      }
    }

    this.lineOffset = -1;
    this.rowOffset = -1;

    this._transactions = {};
  }

  _transform(row, encoding, callback) {
    try {
      this.lineOffset++;

      // see if we have enough information to initialize the adapter
      if (!this.adapter) {
        // give up if we can't choose an adapter within 5 lines
        if (this.lineOffset > 10) {
          callback(new InvalidFormatError());
          return;
        }

        this.mode = checkHeaderPatterns(row);
        if (!this.mode) {
          callback();
          return;
        }

        const fct = adapterFactories[this.mode];
        if (!fct) {
          callback(new UnrecognizedAdapterError());
          return;
        }

        this.adapter = fct();
        this.skipRows = this.adapter.skipRows || 1;
        this.idFunc = this.adapter.id ? this.adapter.id : () => null;
        this.deferUpserts = !!this.adapter.id;

        // always skip the header row
        callback();
        return;
      }

      // some adapters need us to skip more rows than are required to identify the mode
      if (this.lineOffset <= this.skipRows) {
        callback();
        return;
      }

      this.rowOffset++;
      let transfer = false;
      let output;
      let amountString;
      const val = this.adapter.classify(row, this.rowOffset);
      switch (val) {
        case 'skip':
          callback();
          return;
        case 'transfer':
          transfer = true;
        case 'regular': // eslint-disable-line no-fallthrough
          amountString = this.adapter.amount(row);
          output = {
            sourceSystem: `csv|${this.mode}`,
            sourceSystemId: this.idFunc(row),
            sourceSystemMeta: [row],

            transactionDate: normalizeDate(this.adapter.date(row)),
            institution: this.adapter.institution(),
            merchant: this.adapter.merchant(row),
            amountString,
            amount: normalizeAmount(amountString),
            notes: this.adapter.notes(row),

            isTransfer: transfer,
          };

          if (!this.deferUpserts) {
            this.push(output);
          } else {
            const key = `${output.sourceSystem}|${output.sourceSystemId}|${output.transactionDate}`;
            if (!this._transactions[key]) {
              this._transactions[key] = output;
            } else {
              this._transactions[key] = mergeTransactions(
                this._transactions[key],
                output,
              );
            }
          }
          callback();
          break;
        default:
          callback(new InvalidRowClassificationError());
      }
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.deferUpserts) {
      const keys = Object.keys(this._transactions);
      for (let i = keys.length - 1; i >= 0; i--) {
        this.push(this._transactions[keys[i]]);
      }
    }
    callback();
  }
}

function mergeTransactions(tr1, tr2) {
  const result = tr1;
  result.sourceSystemMeta = tr1.sourceSystemMeta.concat(tr2.sourceSystemMeta);
  result.institution = `${tr1.institution}|${tr2.institution}`;
  result.merchant = `${tr1.merchant}|${tr2.merchant}`;
  result.amountString = `${tr1.amountString}|${tr2.amountString}`;
  result.amount = tr1.amount + tr2.amount;
  result.notes = `${tr1.notes}|${tr2.notes}`;
  result.isTransfer = tr1.isTransfer || tr2.isTransfer;

  return result;
}

module.exports = { TransactionParser };

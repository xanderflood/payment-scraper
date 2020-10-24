var csv = require('csv');

const venmoHeader = ["Username", "ID", "Datetime", "Type", "Status", "Note", "From", "To", "Amount (total)", "Amount (fee)", "Funding Source", "Destination", "Beginning Balance", "Ending Balance", "Statement Period Venmo Fees", "Terminal Location", "Year to Date Venmo Fees", "Disclaimer"];
const cashAppHeader = ["Transaction ID", "Date", "Transaction Type", "Currency", "Amount", "Fee", "Net Amount", "Asset Type", "Asset Price", "Asset Amount", "Status", "Notes", "Name of sender/receiver", "Account"];
const boaCreditHeader = ["Posted Date", "Reference Number", "Payee", "Address", "Amount"]
const capitalOneHeader = ["Transaction Date", "Posted Date", "Card No.", "Description", "Category", "Debit", "Credit"]
const boaBankHeader = ["Description", "", "Summary Amt."]      

class InvalidFormatError extends Error {}
class InvalidRowClassificationError extends Error {}
class UnrecognizedAdapterError extends Error {}

function arrayEqual(a,b) {
  return a.length == b.length &&
    a.every((u, i) => u == b[i]);
}

const adapterFactories = {
  boaCredit: () => {
    return {
      classify: (row, i) => {
        if (row[2] == "PAYMENT - THANK YOU") return "transfer"
        if (row[2].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[2].startsWith("VENMO DES:CASHOUT")) return "transfer";
        if (row[2].startsWith("VENMO DES:PAYMENT")) return "transfer";
  
        return "regular"
      },
      id: (row, _) => row[1],
      amount: (row, _) => row[4],
      date: (row, _) => row[0],
      notes: (row, _) => "",
      merchant: (row, _) => row[2],
      institution: () => "boa",
    }
  },
  boaBank: () => {
    return {
      classify: (row, i) => {
        if (row[1].startsWith("OVERDRAFT PROTECTION TO")) return "transfer";
        if (row[1].startsWith("Online Banking transfer")) return "transfer";
        if (row[1] == "BANK OF AMERICA CREDIT CARD Bill Payment") return "transfer";
        if (row[1].startsWith("OVERDRAFT PROTECTION TO")) return "transfer";
        if (row[1].startsWith("OVERDRAFT PROTECTION FROM")) return "transfer";

        if (row[1].startsWith("CAPITAL ONE DES:CRCARDPMT")) return "transfer";
        if (row[1].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[1].startsWith("VENMO DES:CASHOUT")) return "transfer";
        if (row[1].startsWith("VENMO DES:PAYMENT")) return "transfer";

        return "regular";
      },
      id: (row, _) => "",
      amount: (row, _) => row[2],
      date: (row, _) => row[0],
      notes: (row, _) => "",
      merchant: (row, _) => row[1],
      institution: () => "boa",
      skipRows: 7,
    }
  },
  delta: () => {
    return {
      classify: (row, i) => {
        if (row[2] == "Transfer") return "transfer"
        if (row[3] == "VENMO") return "transfer"
  
        return "regular"
      },
      id: (row, _) => row[0],
      amount: (row, _) => {
        if (row[4].length != 0) {
          return row[4]
        }
        return row[5]
      },
      date: (row, _) => row[1],
      notes: (row, _) => row[2],
      merchant: (row, _) => row[3],
      institution: () => "delta",
      skipRows: 4,
    }
  },
  venmo: () => {
    var username = "";

    return {
      classify: (row, i) => {
        if (row[0]) {
          username = row[0];
  
          return "skip"
        }
        if (row[1] == "") return "skip"
        if (row[6] == "") return "transfer"
  
        return "regular"
      },
      id: (row, _) => row[1],
      amount: (row, _) => row[8],
      date: (row, _) => row[2],
      notes: (row, _) => row[5],
      merchant: (row, _) => {
        // TODO switch to a fuzzy match
        if (row[6].replace(/\ /g, "-") == username) {
          return "Venmo - "+row[7]
        }
        return "Venmo - "+row[6]
      },
      institution: () => "venmo",
    };
  },
  cashApp: () => {
    return {
      classify: (row, i) => {
        if (row[9] == "TRANSFER SENT") return "transfer"
  
        return "regular"
      },
      id: (row, _) => row[0],
      amount: (row, _) => row[6],
      date: (row, _) => row[1].replace(/\ /g, "T"),
      merchant: (row, _) => "CashApp - "+row[12],
      notes: (row, _) => row[11],
      institution: () => "CashApp",
    }
  },
  capitalOne: () => {
    return {
      classify: (row, i) => {
        if (row[4] == "Payment/Credit") return "transfer"
        if (row[3].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[3].startsWith("VENMO DES:CASHOUT")) return "transfer";
        if (row[3].startsWith("VENMO DES:PAYMENT")) return "transfer";

        return "regular"
      },
      id: (row, _) => "",
      amount: (row, _) => {
        if (row[5].length != 0) {
          return "-"+row[5]
        }
        return row[6]
      },
      date: (row, _) => row[0],
      merchant: (row, _) => row[3],
      notes: (row, _) => "",
      institution: () => "capitalone",
    }
  },
};

function classifyFile(firstRow) {
  if (arrayEqual(firstRow, boaCreditHeader))
    return "boaCredit";
  if (arrayEqual(firstRow, boaBankHeader))
    return "boaBank";
  if (arrayEqual(firstRow, venmoHeader))
    return "venmo";
  if (arrayEqual(firstRow, cashAppHeader))
    return "cashApp";
  if (arrayEqual(firstRow, capitalOneHeader))
    return "capitalOne";
  if (firstRow[0] && firstRow[0].startsWith("Account Name : "))
    return "delta";
}

function normalizeDate(date) {
  var d = new Date(Date.parse(date));
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`
}

async function TransformRecords(input) {
  var parser = csv.parse({
    skip_empty_lines: true,
    relax_column_count: true,
  });

  var lineOffset = -1;
  var rowOffset = -1;
  let mode;
  let fct;
  let adapter;
  var transformer = csv.transform({ parallel: 1 }, function(row) {
    lineOffset++;
    if (!mode) {
      if (lineOffset > 5)
        throw new InvalidFormatError();
      lineOffset++;

      mode = classifyFile(row);
      if (!mode)
        return;

      fct = adapterFactories[mode];
      if (!fct) throw new UnrecognizedAdapterError;
      adapter = fct();

      return;
    }

    if (adapter.skipRows && lineOffset < adapter.skipRows + 1)
      return;

    rowOffset++;
    var transfer = false;
    val = adapter.classify(row, rowOffset)
    switch (val) {
    case "skip":
      return
    case "transfer":
      transfer = true;
    case "regular":
      var output = {
        sourceSystem: "csv|"+mode,
        sourceSystemId: adapter.id(row),
        sourceSystemMeta: row,

        transactionDate: normalizeDate(adapter.date(row)),
        institution: adapter.institution(),
        merchant: adapter.merchant(row),
        amountString: adapter.amount(row),
        amount: parseFloat(adapter.amount(row).replace(/[\$\s,]/g,"")),
        notes: adapter.notes(row),

        isTransfer: transfer,
      };
      this.push(output);
      break;
    default:
      throw new InvalidRowClassificationError;
    }
  });

  return input.pipe(parser)
    .pipe(transformer);
}

module.exports = { TransformRecords };

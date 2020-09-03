var csv = require('csv');

const venmoHeader = ["Username", "ID", "Datetime", "Type", "Status", "Note", "From", "To", "Amount (total)", "Amount (fee)", "Funding Source", "Destination", "Beginning Balance", "Ending Balance", "Statement Period Venmo Fees", "Year to Date Venmo Fees", "Disclaimer"];
const cashAppHeader = ["Transaction ID", "Date", "Transaction Type", "Currency", "Amount", "Fee", "Net Amount", "Asset Type", "Asset Price", "Asset Amount", "Status", "Notes", "Name of sender/receiver", "Account"];
const boaCreditHeader = ["Posted Date", "Reference Number", "Payee", "Address", "Amount"]
const capitalOneHeader = ["Transaction Date", "Posted Date", "Card No.", "Description", "Category", "Debit", "Credit"]
const boaBankHeader = ["Description", "", "Summary Amt."]      
const deltaHeader = ["Transaction Number", "Date", "Description", "Memo", "Amount Debit", "Amount Credit", "Balance", "Check Number", "Fees ", "Principal "]

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
        if (i == 0) {
          if (!arrayEqual(row, boaCreditHeader)) {
            throw new InvalidFormatError
          }
  
          return "skip"
        }
        if (row[2] == "PAYMENT - THANK YOU") return "transfer"
        if (row[2].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[2].startsWith("VENMO DES:CASHOUT")) return "transfer";
  
        return "regular"
      },
      id: (row, _) => row[1],
      amount: (row, _) => row[4],
      date: (row, _) => row[0],
      notes: (row, _) => "",
      merchant: (row, _) => row[2],
    }
  },
  boaBank: () => {
    return {
      classify: (row, i) => {
        if (i == 0) {
          if (!row[1].startsWith("Beginning balance as of")) {
            throw new InvalidFormatError;
          }
          return "skip";
        }
        if (row[1].startsWith("OVERDRAFT PROTECTION TO")) return "transfer";
        if (row[1].startsWith("Online Banking transfer")) return "transfer";
        if (row[1] == "BANK OF AMERICA CREDIT CARD Bill Payment") return "transfer";
        if (row[1].startsWith("OVERDRAFT PROTECTION TO")) return "transfer";
        if (row[1].startsWith("OVERDRAFT PROTECTION FROM")) return "transfer";

        if (row[1].startsWith("CAPITAL ONE DES:CRCARDPMT")) return "transfer";
        if (row[1].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[1].startsWith("VENMO DES:CASHOUT")) return "transfer";

        return "regular";
      },
      id: (row, _) => "",
      amount: (row, _) => "-"+row[2],
      date: (row, _) => row[0],
      notes: (row, _) => "",
      merchant: (row, _) => row[1],
      skipRows: 7,
    }
  },
  delta: () => {
    return {
      classify: (row, i) => {
        if (i == 0) {
          if (!arrayEqual(row, deltaHeader)) {
            throw new InvalidFormatError
          }
          return "skip"
        }
        if (row[2] == "Transfer") return "transfer"
  
        return "regular"
      },
      id: (row, _) => "",
      amount: (row, _) => {
        if (row[3].length != 0) {
          return row[3]
        }
        return row[5]
      },
      date: (row, _) => row[0],
      notes: (row, _) => "",
      merchant: (row, _) => row[3],
      skipRows: 3,
    }
  },
  venmo: () => {
    var username = "";

    return {
      classify: (row, i) => {
        if (i == 0) {
          if (!arrayEqual(row, venmoHeader)) {
            throw new InvalidFormatError
          }
  
          return "skip"
        }
        if (i == 1) {
          username == row[0];
  
          return "skip"
        }
        if (i == 2) return "skip"
        if (row[1] == "") return "skip"
        if (row[6] == "") return "transfer"
  
        return "regular"
      },
      id: (row, _) => row[1],
      amount: (row, _) => row[8],
      date: (row, _) => row[2],
      notes: (row, _) => row[5],
      merchant: (row, _) => {
        if (row[6] == username) {
          return "Venmo - "+row[7]
        }
        return "Venmo - "+row[6]
      },
    };
  },
  cashApp: () => {
    return {
      classify: (row, i) => {
        if (i == 0) {
          if (!arrayEqual(row, cashAppHeader)) {
            throw new InvalidFormatError
          }
  
          return "skip"
        }
        if (row[9] == "TRANSFER SENT") return "transfer"
  
        return "regular"
      },
      id: (row, _) => row[0],
      amount: (row, _) => row[6],
      date: (row, _) => row[1].replace(/\ /g, "T"),
      merchant: (row, _) => "CashApp - "+row[12],
      notes: (row, _) => row[11],
    }
  },
  capitalOne: () => {
    return {
      classify: (row, i) => {
        if (i == 0) {
          if (!arrayEqual(row, capitalOneHeader)) {
            throw new InvalidFormatError
          }
  
          return "skip"
        }
        if (row[4] == "Payment/Credit") return "transfer"
        if (row[3].startsWith("Square Inc DES:* Cash App")) return "transfer";
        if (row[3].startsWith("VENMO DES:CASHOUT")) return "transfer";

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
    }
  },
};

(function(input, output, mode) {
  var fct = adapterFactories[mode];
  if (!fct) throw new UnrecognizedAdapterError
  var adapter = fct();

  var parser = csv.parse({
    from_line: adapter.skipRows+1,
  });
  var stringifier = csv.stringify({
  	header: true,
    parallel: 1,
  	columns: [
      "source_system",
      "source_system_id",
  		"merchant",
  		"date",
  		"amount",
  		"notes",
      "transfer",
  	],
  });

  var i = -1;
  var transformer = csv.transform({ parallel: 1 }, function(row) {
    i++
    var transfer = false;
    switch (adapter.classify(row, i)) {
    case "skip":
      return
    case "transfer":
      transfer = true;
    case "regular":
      this.push([
        mode,
        adapter.id(row),
        adapter.merchant(row),
        adapter.date(row),
        parseFloat(adapter.amount(row).replace(/[\$\s,]/g,"")),
        adapter.notes(row),
        transfer.toString(),
      ]);
      break;
    default:
      throw new InvalidRowClassificationError;
    }
  });

  input.pipe(parser)
    .pipe(transformer)
    .pipe(stringifier)
    .pipe(output);

})(process.stdin, process.stdout, process.argv[2]);

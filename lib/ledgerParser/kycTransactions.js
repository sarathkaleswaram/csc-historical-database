
var KycTransactions = function (tx) {
    console.log(tx, '--------coming ------------------------tx');
    var transactions = { };
    if (tx.metaData.TransactionResult !== 'tesSUCCESS') {
        return undefined;
    }

    if (tx.TransactionType !== 'Payment') {
        return undefined;
    }

    //ignore 'convert' payments
    if (tx.Account === tx.Destination) {
        return undefined;
    }

    if(tx.kyc_transaction) {
        transactions.tx_hash = tx.hash;
        transactions.tx_index = tx.tx_index;
        transactions.ledger_index = tx.ledger_index;
        transactions.type = tx.TransactionType;
        transactions.result = tx.tx_result;
        transactions.executed_time = tx.executed_time;
        console.log(transactions, '-------------------true');
    }
    return transactions;
}

module.exports = KycTransactions;
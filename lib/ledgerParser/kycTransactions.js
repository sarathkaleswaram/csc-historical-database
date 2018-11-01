
var KycTransactions = function (tx) {
    console.log(tx, '--------coming ------------------------tx');
    var transactions = [];
    if (tx.metaData.TransactionResult !== 'tesSUCCESS') {
        return transactions;
    }

    if (tx.TransactionType !== 'Payment') {
        return transactions;
    }

    //ignore 'convert' payments
    if (tx.Account === tx.Destination) {
        return transactions;
    }

    if(tx.kyc_transaction) {
        var transaction = { };
        transaction.tx_hash = tx.hash;
        transaction.tx_index = tx.tx_index;
        transaction.ledger_index = tx.ledger_index;
        transaction.type = tx.TransactionType;
        transaction.result = tx.tx_result;
        transaction.executed_time = tx.executed_time;
        transactions.push(transaction);
        console.log(transactions, '-------------------true');
    }
    return transactions;
}

module.exports = KycTransactions;
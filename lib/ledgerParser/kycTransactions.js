
var KycTransactions = function (tx) {
    console.log(tx, '--------coming ------------------------tx');
    var transaction = { };
    if (tx.metaData.TransactionResult !== 'tesSUCCESS') {
        return null;
    }

    if (tx.TransactionType !== 'Payment') {
        return null;
    }

    //ignore 'convert' payments
    if (tx.Account === tx.Destination) {
        return null;
    }

    if(tx.kyc_transaction) {
        transaction = tx;
        console.log(tx, '-------------------true');
    }
    return transaction;
}

module.exports = KycTransactions;
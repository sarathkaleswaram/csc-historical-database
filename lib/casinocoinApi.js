var config = require('../config')
var casinocoin = require('casinocoin-libjs')
var CasinocoinAPI = new casinocoin.CasinocoinAPI(config.get('casinocoin'))

CasinocoinAPI.connect()
.then(function() {
  console.log('CasinoCoin API connected.')
})
.catch(function(e) {
  console.log(e)
})

CasinocoinAPI.on('error', function(errorCode, errorMessage, data) {
  console.log(errorCode, errorMessage, data)
})

module.exports = CasinocoinAPI

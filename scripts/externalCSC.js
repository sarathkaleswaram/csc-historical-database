/* eslint no-unused-vars: 1 */
'use strict'

var request = require('request-promise')
var smoment = require('../lib/smoment')
var moment = require('moment')
var hbase = require('../lib/hbase')
var table = 'agg_exchanges_external'
var timeout = 8000

var markets = [
    'NLExch|CSC|BTC',
    'BitFlip|CSC|BTC',
    'CFinex|CSC|BTC'
  ]
/**
 * round
 * round to siginficant digits
 */

function round(n, sig) {
    var mult = Math.pow(10,
    sig - Math.floor(Math.log(n) / Math.LN10) - 1)
    return Math.round(n * mult) / mult
}

/**
 * getNlexch
 */

function getNlexch(currency) {

    var start = smoment()
    var end = smoment()
    var c = currency

    start.moment.subtract(1, 'days')
    var url = 'https://poloniex.com/public?' +
        'command=returnChartData&currencyPair=' +
        currency + '_XRP&period=300' +
        '&start=' + start.moment.unix() +
        '&end=' + end.moment.unix()

    if (c === 'USDT') {
        c = 'USD'
    }

    console.log(url,'----url')   
    return request({
        url: url,
        json: true,
        timeout: timeout
    }).then(function(resp) {
        // console.log(resp, '------------------getPoloniex')
        var results = []
        resp.forEach(function(r) {

        // only include intervals with a trade
        if (r.volume === 0) {
            return
        }

        results.push({
            date: smoment(r.date).format(),
            source: 'poloniex.com',
            interval: '5minute',
            base_currency: 'XRP',
            counter_currency: c,
            base_volume: r.quoteVolume,
            counter_volume: r.volume,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            vwap: r.weightedAverage
        })
        })

        console.log('poloniex.com', c, results.length)
        return results
    })
    .catch(function(e) {
        console.log('polniex.com error:', c, e)
    })
}

/**
 * getCfinex
 */

function getCfinex() {

  var url = 'https://cfinex.com/api/tickerapi'

  return request({
    url: url,
    json: true,
    timeout: timeout,
    qs: {
      time: 'hour'
    }
  }).then(function(resp) {
    console.log(resp.CSC_BTC, resp.CSC_TUSD, '----------------getCfinex')
    var buckets = {}

    resp.forEach(function(d) {
      var bucket = moment(d.timestamp).utc()
      var price = Number(d.price)
      var amount = Number(d.amount)

      bucket = bucket.startOf('minute')
      .format('YYYY-MM-DDTHH:mm:ss[Z]')

      if (!buckets[bucket]) {
        buckets[bucket] = {
          base_volume: 0,
          counter_volume: 0,
          count: 0,
          open: price,
          high: price,
          low: price,
          close: price
        }
      }

      if (price > buckets[bucket].high) {
        buckets[bucket].high = price
      }

      if (price < buckets[bucket].low) {
        buckets[bucket].low = price
      }


      buckets[bucket].close = price
      buckets[bucket].base_volume += amount
      buckets[bucket].counter_volume += amount * price
      buckets[bucket].count++
    })

    var results = Object.keys(buckets).map(function(key) {
      var row = buckets[key]
      row.source = 'korbit.co.kr'
      row.interval = '1minute'
      row.base_currency = 'XRP'
      row.counter_currency = 'KRW'
      row.date = key
      row.vwap = row.counter_volume / row.base_volume
      row.vwap = round(row.vwap, 6)
      return row
    })

    // drop the oldest row,
    // since we dont know if
    // all exchanges were represented
    results.pop()
    console.log('korbit.co.kr', results.length)
    return results
  })
  .catch(function(e) {
    console.log('bitstamp error:', e)
  })
}

/**
 * getAllExchanges
 */

function getAllExchanges() {

    var url = 'https://api.casinocoin.org/1.0.0/info/exchanges/all'

    return request({
        url: url,
        json: true,
        timeout: timeout
    }).then(function(resp) {
        var results = []
        resp.forEach(function(r) {
            results.push({
                date: smoment(r.creationDate).format(),
                source: r.name,
                interval: '5minute',
                base_currency: 'CSC',
                counter_currency: 'BTC',
                base_volume: r.volume24H,
                counter_volume: r.volume24H,
                sell_volume: Number(r.sell).toFixed(8),
                buy_volume: Number(r.buy).toFixed(8)
                // open: r.open,
                // high: r.high,
                // low: r.low,
                // close: r.close,
                // vwap: r.weightedAverage
            })
        })

        console.log('all exchanges length', results.length)
        return results
    })
    .catch(function(e) {
        console.log('Error: ', e)
    })
}

/**
 * save
 */

function save(data) {  
    var rows = {}
    data.forEach(function(rowset) {
      if (!rowset) {
        return
      }
  
      rowset.forEach(function(r) {
        var date = smoment(r.date)
        var rowkey = r.source + '|' +
          r.base_currency + '|' +
          r.counter_currency + '|' +
          r.interval + '|' +
          date.hbaseFormatStartRow()
  
        rows[rowkey] = {
          'f:date': r.date,
          'f:source': r.source,
          'f:interval': r.interval,
          'f:base_currency': r.base_currency,
          'f:counter_currency': r.counter_currency,
          base_volume: r.base_volume,
          counter_volume: r.counter_volume,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          vwap: r.vwap,
          count: r.count,
          buy_count: r.buy_count,
          sell_count: r.sell_count,
          buy_volume: r.buy_volume,
          sell_volume: r.sell_volume
        }
      })
    })
  
    console.log('saving ' + Object.keys(rows).length + ' rows')
    return hbase.putRows({
      table: table,
      rows: rows
    })
}

/**
 * savePeriod
 */

function savePeriod(period, increment) {

    var tasks = []
    var end = smoment()
    var start = smoment()
    var label = (increment || '') + period
  
    // save single market
    function saveMarket(m) {
      return new Promise(function(resolve, reject) {
        var startRow = m + '|5minute|' + start.hbaseFormatStartRow()
        var stopRow = m + '|5minute|' + end.hbaseFormatStopRow()
        console.log(startRow, '------------', stopRow)
  
        hbase.getScan({
          table: table,
          startRow: startRow,
          stopRow: stopRow
        }, function(err, resp) {
          if (err) {
            reject(err)
  
          } else if (!resp.length) {
            console.log(m + ': no data')
            resolve()
  
          } else {
            var d = reduce(resp)
            var parts = m.split('|')
            d.source = parts[0]
            d.base_currency = parts[1]
            d.counter_currency = parts[2]
            resolve(d)
          }
        })
      })
    }
  
    start.moment.subtract(increment || 1, period)
  
    markets.forEach(function(m) {
      tasks.push(saveMarket(m))
    })
  
    return Promise.all(tasks)
    .then(function(components) {
  
      var result = {
        components: components.filter(function(d) {
          return Boolean(d)
        }),
        period: label,
        total: 0,
        date: end.format()
      }
  
      result.components.forEach(function(d) {
        result.total += d.base_volume
      })
  
      console.log('saving: ' + label +
                  ' ' + result.total + ' CSC')
      return hbase.putRow({
        table: 'agg_metrics',
        rowkey: 'trade_volume|external|live|' + label,
        columns: result
      })
    })
}

Promise.all([
    // getNlexch('USD'),
    // getCfinex(),
    getAllExchanges()
])
.then(save)
.then(savePeriod.bind(this, 'hour', 1))
.then(savePeriod.bind(this, 'day', 1))
.then(savePeriod.bind(this, 'day', 3))
.then(savePeriod.bind(this, 'day', 7))
.then(savePeriod.bind(this, 'day', 30))
.then(function() {
    console.log('success')
    process.exit(0)
})
.catch(function(e) {
    console.log('error', e, e.stack)
    process.exit(1)
})

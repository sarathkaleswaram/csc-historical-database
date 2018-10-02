/* eslint no-unused-vars: 1 */
'use strict'

var request = require('request-promise')
var smoment = require('../lib/smoment')
var moment = require('moment')
var hbase = require('../lib/hbase')
var table = 'agg_exchanges_external'
var timeout = 8000

var markets = [
    'nlexch.com|CSC|BTC',
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

    // var pair = ('xrp' + currency).toLowerCase()
    var url = 'https://www.nlexch.com//api/v2/tickers/cscbtc'
  
  
    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(function(resp) {
        console.log(resp, '----------------getNlexch')
      var buckets = {}
  
      resp.forEach(function(d) {
        var bucket = moment.unix(d.date).utc()
        var price = Number(d.price)
        var amount = Number(d.amount)
  
        bucket = bucket.startOf('minute')
        .format('YYYY-MM-DDTHH:mm:ss[Z]')
  
        if (!buckets[bucket]) {
          buckets[bucket] = {
            base_volume: 0,
            counter_volume: 0,
            count: 0,
            buy_volume: 0,
            sell_volume: 0,
            buy_count: 0,
            sell_count: 0,
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
  
        if (d.type === '1') {
          buckets[bucket].sell_volume += amount
          buckets[bucket].sell_count++
        } else {
          buckets[bucket].buy_volume += amount
          buckets[bucket].buy_count++
        }
      })
  
      var results = Object.keys(buckets).map(function(key) {
        var row = buckets[key]
        row.source = 'bitstamp.net'
        row.interval = '1minute'
        row.base_currency = 'XRP'
        row.counter_currency = currency
        row.date = key
        row.vwap = row.counter_volume / row.base_volume
        row.vwap = round(row.vwap, 6)
        return row
      })
  
      // drop the oldest row,
      // since we dont know if
      // all exchanges were represented
      results.pop()
      console.log('bitstamp.net', currency, results.length)
      return results
    })
    .catch(function(e) {
      console.log('bitstamp error:', e)
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
 * save
 */

function save(data) {
    console.log(data, '-------------------save')
    // process.exit()
  
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

Promise.all([
    getNlexch('USD'),
    getCfinex()
])
.then(save)
.then(function() {
    console.log('success')
    process.exit(0)
})
.catch(function(e) {
    console.log('error', e, e.stack)
    process.exit(1)
})

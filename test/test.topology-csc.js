'use strict'

var config = require('../config')
var request = require('request')
var Promise = require('bluebird')
var assert = require('assert')
var moment = require('moment')
var smoment = require('../lib/smoment')
var utils = require('./utils')

var hbase = require('../lib/hbase')
var geolocation = require('../lib/validations/geolocation')
var saveVersions = require('../scripts/saveVersions')
var mockTopologyInfo = require('./mock/topology-info-csc.json')

var geo = geolocation({
    table: config.get('hbase:prefix') + 'node_state',
    columnFamily: 'd'
})

describe('setup mock data', function () {
    it('load data into hbase', function (done) {
        var rows = []
        mockTopologyInfo.forEach(function (r) {
            rows.push(hbase.putRow({
                table: 'crawls',
                rowkey: r.rowkey,
                columns: r
            }))
        })
        Promise.all(rows).nodeify(function (err) {
            assert.ifError(err)
            done()
        })
    })
    it('import rippled versions', function () {
        this.timeout(10000)
        return saveVersions(hbase)
    })
})
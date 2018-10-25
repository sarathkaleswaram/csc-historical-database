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
var mockTopologyInfo = require('./mock/topology-info-crawls-csc.json')
var mockTopologyNodes = require('./mock/topology-nodes-crawl_node_stats-csc.json')

var mockTopologyLinks = require('./mock/topology-links.json')

var now = Date.now()

describe('setup mock data', function () {
    it('load data into hbase', function (done) {
        var rows = []

        var parts = mockTopologyNodes[0].rowkey.split('+')
        console.log(parts, '-------------------parts')
        var range = now + '_' + now
        console.log(range, '-------------------range')

        mockTopologyNodes[0].rowkey = range + '+' + parts[1]
        console.log(mockTopologyNodes[0].rowkey, '-------------------mockTopologyNodes[0].rowkey')
        parts = mockTopologyLinks[0].rowkey.split('+')
        console.log(parts, '-------------------parts')
        mockTopologyLinks[0].rowkey = range + '+' + parts[1]
        console.log(mockTopologyLinks[0].rowkey, '-------------------mockTopologyLinks[0].rowkey')
        mockTopologyInfo[0].rowkey = range
        console.log(mockTopologyInfo[0].rowkey, '-------------------mockTopologyInfo[0].rowkey')
        
        mockTopologyInfo.forEach(function (r) {
            rows.push(hbase.putRow({
                table: 'crawls',
                rowkey: r.rowkey,
                columns: r
            }))
        })

        mockTopologyNodes.forEach(function (r) {
            rows.push(hbase.putRow({
                table: 'crawl_node_stats',
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
        this.timeout(1000)
        return saveVersions(hbase)
    })
})
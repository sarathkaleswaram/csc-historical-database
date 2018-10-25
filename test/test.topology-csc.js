'use strict'

var config = require('../config')
var Promise = require('bluebird')
var assert = require('assert')

var hbase = require('../lib/hbase')
var geolocation = require('../lib/validations/geolocation')
var saveVersions = require('../scripts/saveVersions')
var mockTopologyInfo = require('./mock/topology-info-crawls-csc.json')
var mockTopologyNodes = require('./mock/topology-nodes-crawl_node_stats-csc.json')

var now = Date.now()
var geo = geolocation({
    table: config.get('hbase:prefix') + 'node_state',
    columnFamily: 'd'
})

describe('setup mock data', function () {
    it('load data into hbase', function (done) {
        var rows = []

        // var parts = mockTopologyNodes[0].rowkey.split('+')
        // var range = now + '_' + now

        // mockTopologyNodes[0].rowkey = range + '+' + parts[1]
        // mockTopologyInfo[0].rowkey = range

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

    it('should update node geolocation', function(done) {
        this.timeout(5000)    
        geo.geolocateNodes()
        .then(done)
        .catch(e => {
          assert.ifError(e)
        })
    })

    // it('import rippled versions', function () {
    //     this.timeout(5000)
    //     return saveVersions(hbase)
    // })
})
var fs = require('fs');
var async = require('async');

var models = require('./models');


var Feature = models.Feature;
var DbFile = models.DbFile;
var RefSeq = models.RefSeq;

function getRefRegion(region, callback) {
    async.waterfall([
        function(wfCbk) {
            // get all those that start within region
            RefSeq.find({
                chrom: region.chrom,
                $or: [
                    {starts: {'$gte': region.start, '$lte': region.end}},
                    {ends: {'$gte': region.start, '$lte': region.end}},
                    {starts: {'$lte': region.start}, ends: {'$gte': region.end}}
                ]
            }, wfCbk);
        },
        function(fragments, wfCbk) {
            async.sortBy(fragments, function(fragment, sortCbk) {
                return sortCbk(null, fragment.starts);
            },wfCbk);
        },
        function(fragments, wfCbk) {
            async.reduce(fragments, '', function(memo, fragment, redCbk) {
                return redCbk(null, memo += fragment.sequence);
            }, function(err, refseq) {
                if (err) {throw err;}
                return wfCbk(null, {'fragments': fragments, 'refseq': refseq});
            });
        },
        function(data, wfCbk) {
            var fragStart = data.fragments[0].starts;
            var sliceStart = region.start - fragStart;
            var sliceEnd = region.end - fragStart + 1;
            refSeq = data.refseq.slice(sliceStart, sliceEnd);
            return callback(null, refSeq);
        }
    ]);
}

function getFeatures(region, callback) {
    var regionQuery = {
      type: {$in: [/^SNP/, 'gene', 'five_prime_UTR', 'three_prime_UTR', 'CDS']},
      seqid: {$regex: region.chrom},
      start: {$gte: region.start, $lte: region.end}
    };
    Feature.find(regionQuery, callback);
}

function getRegion(region, callback) {
    async.parallel({
        features: function(paraCbk) {
            getFeatures(region, paraCbk);
        },
        refseq: function(paraCbk) {
            getRefRegion(region, function(err, data) {
                if (err) {throw err;}
                paraCbk(null, data);
            });
        }
    },
    function(err, data) {
        if (err) {throw err;}
        data.region = region;
        callback(null, data);
    });
}

////////////////////
exports.Feature = Feature;
exports.getRegion = getRegion;
exports.getFeatures = getFeatures;

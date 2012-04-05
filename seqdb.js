var fs = require('fs');
var async = require('async');
var mongoose = require('mongoose');

var models = require('./models');


var Feature = models.Feature;
var RefSeq = models.RefSeq;
var Strain = models.Strain;
var RefList = models.RefList;
var registerModels = models.registerModels;

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
            if (!data.fragments.length) {
              return callback(null, "");  
            }
            var fragStart = data.fragments[0].starts;
            var sliceStart = region.start - fragStart;
            var sliceEnd = region.end - fragStart + 1;
            refSeq = data.refseq.slice(sliceStart, sliceEnd);
            return callback(null, refSeq);
        }
    ]);
}

function getFeatureRegion(name, flank, callback) {
    Feature.find({
        'attributes.Name' : name
    }, function(err, doc) {
        if (err) {callback(err);}
        else if (doc.length === 0) {callback(null, {});}
        else {
            var start = doc[0].start - flank;
            start = start > 0 ? start : 0;
            var end = doc[0].end + flank;
            var chrom = doc[0].seqid;
            callback(null, {start: start, end: end, chrom: chrom});
        }
    });
}

function getFeatures(region, callback) {
    var regionQuery = {
      type: {$in: [/^SNP/, 'gene', 'five_prime_UTR', 'three_prime_UTR', 'CDS', 'trait']},
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

function getAllStrains(callback) {
  Strain.find({}, function(err, data) {
    if (err) {throw err;}
    callback(data[0].strainList);
    })
  // callback(null, data)  
}

function getRefList(callback) {
  RefList.find({}, function(err, data) {
    if (err) {throw err;}
    var reflist = data[0].list;
    // register models for each reference genome
    registerModels(reflist, function (err) {
      if (err) {throw err;} 
    });
    callback(reflist);
  });
}

function switchDb(dbName) {
  console.log("switching db");
  connection = mongoose.createConnection('mongodb://localhost/' + dbName);
  Feature = connection.model('Feature');
  RefSeq = connection.model('RefSeq');
  Strain = connection.model('Strain');
}


////////////////////
exports.Feature = Feature;
exports.getRegion = getRegion;
exports.getFeatures = getFeatures;
exports.getFeatureRegion = getFeatureRegion;
exports.getAllStrains = getAllStrains;
exports.getRefList = getRefList;
exports.switchDb = switchDb;

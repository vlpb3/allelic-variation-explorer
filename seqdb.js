// import modules
var fs = require('fs');
var async = require('async');
var mongoose = require('mongoose');

// import defined models
var models = require('./models');

// fetch database connection
// it gives access to the models
var dbConnection = models.dbConnection;
var Feature = dbConnection.model("Feature");
var RefSeq = dbConnection.model("RefSeq");
var GenomeStrains = dbConnection.model("genomestrains");

function getRefRegion(region, callback) {
    async.waterfall([
        function(wfCbk) {
            // get all those that start within region
            RefSeq.find({
                genome: region.genome,
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

function getFeatureRegion(genome, name, flank, callback) {
    Feature.find({
        'attributes.genome': genome,
        'attributes.Name': name
    }, function(err, doc) {
        if (err) {callback(err);}
        else if (doc.length === 0) {callback(null, {});}
        else {
            var genome = doc[0].attributes.genome;
            var start = doc[0].start - flank;
            start = start > 0 ? start : 0;
            var end = doc[0].end + flank;
            var chrom = doc[0].seqid;
            callback(
              null,
              {genome: genome, start: start, end: end, chrom: chrom}
            );
        }
    });
}

function getFeatures(region, callback) {
    var regionQuery = {
      'attributes.genome': region.genome,
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

function getAllStrains(genome, callback) {
  GenomeStrains.findOne({'genome': genome}, function(err, data) {
    if (err) {throw err;}
    callback(data.strains);
    })
  // callback(null, data)  
}

function getRefList(callback) {
  GenomeStrains.find().distinct('genome', function(err, data) {
    if (err) {throw err;}
    callback(data);
  });
}

////////////////////
exports.Feature = Feature;
exports.getRegion = getRegion;
exports.getFeatures = getFeatures;
exports.getFeatureRegion = getFeatureRegion;
exports.getAllStrains = getAllStrains;
exports.getRefList = getRefList;

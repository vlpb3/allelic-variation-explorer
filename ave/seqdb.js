var fs = require('fs');
var Step = require('step');
var async = require('async');

var models = require('./models');

var Feature = models.Feature;
var GeneModel = models.GeneModel;
var Locus = models.Locus;

var DATA_DIR = process.cwd() + '/data/';
var MAX_LEN = 0;
var SCALE = 1000000;

function addFeatures(data, callback) {
	var flines = data.split('\n');
	var left = flines.length;
	flines.forEach(function (iLine){
		if ( (iLine[0] !== '#') && (iLine.length > 0) ) {
			var farr = iLine.split('\t');
			var feature = new Feature();
			feature.seqid = farr[0];
			feature.source = farr[1];
			feature.type = farr[2];
			var ichrom = parseInt(farr[0].split('Chr')[1], 10);
			var start = parseInt(farr[3], 10) / SCALE;
			var end = parseInt(farr[4], 10) / SCALE;
			feature.start = [ichrom, start];
			feature.end = [ichrom, end];
			feature.score = farr[5];
			feature.strand = farr[6];
			feature.phase = farr[7];
			var attrarr = farr[8].split(';');
			feature.attributes = {};
			var i;
			for (i = 0; i<attrarr.length; ++i) {
				var attr = attrarr[i].split('=');
				var key = attr[0];
				var val = attr[1];
				feature.attributes[key] = val;
			}
            if (farr[2] !== 'chromosome') {
				var len = end - start;
				MAX_LEN = len > MAX_LEN ? len : MAX_LEN;
			};

			feature.save(function(err){
				if (err) callback(err);
				if (--left === 0) callback(null, 'Features deployed in db.');
			});
			
		} else {
			if (--left === 0) callback(null, 'Features deployed in db.');
		};
	}); 
}

function makeLocusDb(callback){
	async.series([
		function(seriesCallback) {
      Feature.find({type: 'gene'}, function(err, genes) {
				if (err) return seriesCallback(err);
				var left = genes.length;
				genes.forEach(function(gene) {
					locus = new Locus;
					locus.gene = gene;
          locus.start = gene.start;
          locus.end = gene.end;
					locus.save(function(err) {
						if (err) return seriesCallback(err);
						if(--left === 0) {
							return seriesCallback(null, 'all loci created and saved');
						};
					});
				});				
			});
		},
		function(seriesCallback) {
		    Feature.find({
		        type: 'mRNA'
		    },
		    function(err, mRNAs) {
		        if (err) return callback(err);
		        var left = mRNAs.length;
		        mRNAs.forEach(function(mRNA) {
		            var mRNAparent = mRNA.attributes.Parent;
		            var mRNAname = mRNA.attributes.Name;
		            async.parallel({
		                proteins: function(parallelCallback) {
		                    Feature.find({
		                        type: 'protein',
		                        "attributes.Derives_from": mRNAname
		                    },
		                    function(err, proteins) {
		                        if (err) return parallelCallback(err);
		                        return parallelCallback(null, proteins);
		                    });
		                },
		                fivePrimeUTRs: function(parallelCallback) {
		                    Feature.find({
		                        type: 'five_prime_UTR',
		                        'attributes.Parent': mRNAname
		                    },
		                    function(err, fivePrimeUTRs) {
		                        if (err) return parallelCallback(err);
		                        return parallelCallback(null, fivePrimeUTRs);
		                    });
		                },
		                CDSs: function(parallelCallback) {
		                    Feature.find({
		                        type: 'CDS',
		                        'attributes.Parent': {
		                            $regex: mRNAname
		                        }
		                    },
		                    function(err, CDSs) {
		                        if (err) return parallelCallback(err);
		                        return parallelCallback(null, CDSs);
		                    });
		                },
		                exons: function(parallelCallback) {
		                    Feature.find({
		                        type: 'exon',
		                        'attributes.Parent': mRNAname
		                    },
		                    function(err, exons) {
		                        if (err) return parallelCallback(err);
		                        return parallelCallback(null, exons);

		                    });
		                },
		                threePrimeUTRs: function(parallelCallback) {
		                    Feature.find({
		                        type: 'three_prime_UTR',
		                        'attributes.Parent': mRNAname
		                    },
		                    function(err, threePrimeUTRs) {
		                        if (err) return parallelCallback(err);
		                        return parallelCallback(null, threePrimeUTRs);

		                    });
		                }
		            },
		            function(err, results) {
		                if (err) return parallelCallback(err);
		                var geneModel = new GeneModel;
		                geneModel.mRNA = mRNA;
		                geneModel.protein = results.proteins;
		                geneModel.fivePrimeUTRs = results.fivePrimeUTRs;
		                geneModel.CDSs = results.CDSs;
		                geneModel.exons = results.exons;
		                geneModel.threePrimeUTRs = results.threePrimeUTRs;

		                Locus.update({
		                    "gene.attributes.Name": mRNAparent
		                },
		                {$push: {geneModels: geneModel}
		                },
		                function(err) {
		                    if (err) return seriesCallback(err);
		                    if (--left === 0) {
													return seriesCallback(null, 'all mRNAs processed');
												};
		                });
		            });
		        });
		    });
		}   
	 ],
	function(err, results){
		if (err) return callback(err);
		return callback(null, "Creating loci db finished.");
	}
	);
}

function getGffFiles(callback){
	fs.readdir(DATA_DIR, function(err, files) {
		if (err) return callback(err);
		var gffFiles = [];
		var left = files.length;
		files.forEach(function(iFile) {
			if (iFile.slice(-4) === '.gff') {
				gffFiles.push(DATA_DIR + iFile);
			}
			if (--left === 0 ) {
				return callback(null, gffFiles);
			}
		});
	});
}

function importGff(callback) {
	async.waterfall([
		function(waterfallCallback) {
			getGffFiles(waterfallCallback);
		},
		function(gffFiles, waterfallCallback){
			var left = gffFiles.length;
			var gffData = '';
			gffFiles.forEach(function(iFile) {
				fs.readFile(iFile, 'utf8', function (err, data){
					if (err) return waterfallCallback(err);
					gffData += data;
					if (--left === 0) return waterfallCallback(null, gffData);
				});
			});
		},
		function(data, waterfallCallback) {
			addFeatures(data, waterfallCallback);
		},
		function(data, waterfallCallback){
			makeLocusDb(waterfallCallback);
		},
		function(data, waterfallCallback){
			return callback(null, data);
		}
	]);
}

function reloadDb (callback){
	async.series([
		// first delete old data from databse
		function(seriesCallback){
			var models = [Feature, Locus, GeneModel];
			var left = models.length;
			models.forEach(function(model) {
				drop(model);
				if(--left === 0) {
					return seriesCallback(null, "Old data deleted from db.");
				};
			});
		},
		// read in gff files and put all the features into db
		function(seriesCallback) {
			importGff(seriesCallback);
		}
		],
		function(err, results){
			if (err) callback(err);
			return callback(null, results);
		}
	);
}

function drop(model) {
	//var model = mongoose.model(model);
	model.collection.drop();
}

// loc should be {chrom: ,start: ,stop: }
function getFromRegion(model, type, loc, callback) {
	// var model = mongoose.model(model);
	var start =  loc.start / SCALE - MAX_LEN;
	var end = loc.end / SCALE + MAX_LEN;
	var box = [[loc.chrom - 0.1, start],
		[loc.chrom + 0.1, end]];
	model.find({
		start: {$within: {$box: box}},
		start: {'$lt': loc.end / SCALE },
		end: {'$gt': loc.start / SCALE },
		type: type
		},
		function(err, doc) {
			if (err) callback(err);
			callback(null, doc);
		});
}

exports.addFeatures = addFeatures;

// tests
// console.log('test');
function testdb1() {
	var sf = 'Chr1\tTAIR10\tprotein\t3760\t5630\t.\t+\t.\t' +
	'ID=AT1G01010.1-Protein;Name=AT1G01010.1;Derives_from=AT1G01010.1';
	addFeatures(sf);
}

function testdb4() {
	getFromRegion(Feature, 'protein', {chrom: 1, start: 100, end: 3800});
}


////////////////////
exports.getFromRegion = getFromRegion;
exports.Feature = Feature;
exports.reloadDb = reloadDb;

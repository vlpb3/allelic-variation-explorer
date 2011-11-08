var fs = require('fs');
var async = require('async');
var _ = require('underscore');

var models = require('./models');


var Feature = models.Feature;
var GeneModel = models.GeneModel;
var Locus = models.Locus;
var DbFile = models.DbFile;
var RefSeq = models.RefSeq;

var DATA_DIR = process.cwd() + '/data/';
var MAX_LEN = 5000;
var SCALE = 1000000;
var CHROM_LEN = {
	1: 34.964571,
	2: 22.037565,
	3: 25.499034,
	4: 20.862711,
	5: 31.270811};

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
			var start = parseInt(farr[3], 10);
			var end = parseInt(farr[4], 10);
			feature.start = start;
			feature.end = end;
			feature.startIdx = [ichrom, start/SCALE];
			feature.endIdx = [ichrom, end/SCALE];
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
			}

			feature.save(function(err){
				if (err) callback(err);
				if (--left === 0) callback(null, 'Features deployed in db.');
			});
			
		} else {
			if (--left === 0) callback(null, 'Features deployed in db.');
		}
	}); 
}

function makeLocusDb(callback){
	async.series([
		function(seriesCallback) {
      Feature.find({type: 'gene'}, function(err, genes) {
				if (err) return seriesCallback(err);
				var left = genes.length;
				genes.forEach(function(gene) {
					locus = new Locus();
					locus.gene = gene;
          locus.startIdx = gene.startIdx;
          locus.endIdx = gene.endIdx;
					locus.save(function(err) {
						if (err) return seriesCallback(err);
						if(--left === 0) {
							return seriesCallback(null, 'all loci created and saved');
						}
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
		                var geneModel = new GeneModel();
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
												}
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
			  var dbFile = new DbFile();
			  dbFile.file = iFile;
			  dbFile.save(function(err) {
			    if (err) 
			      throw err;
			  });
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

function onDbFilesChange() {
  async.parallel({
    filesInDb: function(asyncCallback) {
      DbFile.find({}, asyncCallback);
    },
    filesInFolder: function(asyncCallback) {
      getGffFiles(asyncCallback);
    }
  },
  function(err, results) {
    if (err) throw err;
    var filesInDb = _.pluck(results.filesInDb, 'file');
    
    // if both lists are of same size, check if they have same elements
    if (_.size(results.filesInDb) === _.size(results.filesInFolder)) {
      if (_.difference(results.filesInFolder, filesInDb).length > 0) {
        reloadDb(function(err, result) {
          if (err) throw err;
          console.log('reloaded db \n results: ');
          console.log(result);
        });
      }
    }
    else reloadDb(function(err, result) {
      if (err) throw err;
      console.log('reloaded db\n results: ');
      console.log(result);
      console.log("Please restart app to finish database update");
    });
  }
  );  
}

function reloadDb (callback){
	async.series([
		// first delete old data from databse
		function(seriesCallback){
			var models = [Feature, Locus, GeneModel, DbFile];
			var left = models.length;
			models.forEach(function(model) {
				drop(model);
				if(--left === 0) {
					return seriesCallback(null, "Old data deleted from db.");
				}
			});
		},
		// read in gff files and put all the features into db
		function(seriesCallback) {
		  async.parallel([
		      importGff,
		      importRefSeq
		    ], function(err, results) {
		      if (err) throw err;
		      seriesCallback(null, "data imported");
		    });
		}
		],
		function(err, results){
			if (err) callback(err);
			return callback(null, results);
		}
	);
}

function importRefSeq(callback) {
  // pattern for getting position of the seq in fasta file
  // assumes pattern (Chr1:1..1000)
  var chunk = 1000;
  console.log("importing fasta");
  
  async.waterfall([
    function(wfallCbk){
      fs.readdir(DATA_DIR, wfallCbk);
    },
    function(files, wfallCbk) {
      var fastaFiles = _.filter(files, function(iFile) {
        return iFile.split(".")[1] === "fas";
      });
      wfallCbk(null, fastaFiles);
    },
    function(fastaFiles, wfallCbk) {
      var allData = [];
      // concatenate data from all fasta files
      async.forEach(fastaFiles, function(iFile, fEachCbk) {
        
        fs.readFile(DATA_DIR + iFile, 'utf8', function(err, data) {
          if (err) throw err;
          var lines = data.split("\n");
          allData = allData.concat(lines);
          fEachCbk();
        });
      }, function() {
        wfallCbk(null, allData);
      });
    },
    function(data, wfallCbk) {
      var chunk = 10000;
      var locPattern = />Chr(\d+):(\d+)\.\.(\d+)/;
      var refSeq = new RefSeq();
      var chrom, starts, ends;
      async.forEachSeries(data, function(line, fEachSerCbk) {
        //if matches header get header data     
        var match = line.match(locPattern);
        if (match) {
          refSeq = new RefSeq();
          chrom = parseInt(match[1], 10);
          starts = parseInt(match[2], 10);
          ends = parseInt(match[3], 10);
          refSeq.chrom = chrom;
          refSeq.starts = starts;
          refSeq.startIdx = [chrom, starts/SCALE];
          refSeq.sequence = "";
        }
        else refSeq.sequence += line;
        if (refSeq.sequence.length >= chunk) {
          var newRefSeq = new RefSeq();
          newRefSeq.chrom = chrom;
          newRefSeq.sequence = refSeq.sequence.slice(chunk + 1);
          refSeq.sequence = refSeq.sequence.slice(0, chunk);
          refSeq.ends = refSeq.starts + refSeq.sequence.length - 1;
          refSeq.endIdx = [chrom, refSeq.ends/SCALE];
          newRefSeq.starts = refSeq.ends + 1;
          newRefSeq.startIdx = [chrom, newRefSeq.starts/SCALE];
          refSeq.save(function(err) {
              if (err) {
                console.log("error while saving reference seq");
                throw err;
              }
              refSeq = newRefSeq;
              fEachSerCbk();
            });
        } else fEachSerCbk();
      }, callback);
    }
  ]);
}

function getRefRegion(region, callback) {
  async.parallel([
    function(paralCbk) {
      RefSeq.find({
        chrom: region.chrom,
        starts: {"$gte": region.start, "$lte": region.end}
      }, paralCbk);
    },
    function(paralCbk) {
      RefSeq.find({
      chrom: region.chrom,
      ends: {"$gte": region.start, "$lte": region.end}
      }, paralCbk);
    },
    function(paralCbk) {
      RefSeq.find({
        chrom: region.chrom,
        starts: {"$lte": region.start},
        ends: {"$gte": region.end}
      }, paralCbk);
    }],
    function(err, data) {
      if (err) throw err;
      console.log("data: ");
      console.log(data);
      data = _.flatten(data);
      data = _.sortBy(data, function(fragment) {
        return fragment.starts;
      });
      var refSeq = _.pluck(data, "sequence").join();
      var fragStart = data[0].starts;
      var sliceStart = region.start - fragStart;
      var sliceEnd = region.end - fragStart + 1;
      refSeq = refSeq.slice(sliceStart, sliceEnd);
      callback(null, refSeq);
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
		startIdx: {$within: {$box: box}},
		startIdx: {'$lt': loc.end / SCALE },
		endIdx: {'$gt': loc.start / SCALE },
		type: type
		},
		function(err, doc) {
			if (err) callback(err);
			callback(null, doc);
		});
}

function getRegion(region, callback) {
  var start = region.start/SCALE;
  var end = region.end/SCALE;
  var chrom = region.chrom;
  var leftEnd = start - MAX_LEN/SCALE;
  leftEnd = leftEnd > 0 ? leftEnd : 0; 
  var box = [[chrom - 0.1, start], [chrom + 0.1, end]];
  var leftBox = [[chrom - 0.1, leftEnd], [chrom + 0.1, end]];
  async.parallel({
    loci: function(callback) {
      Locus.find({
        startIdx: {$within: {$box: leftBox}}
      }, function(err, doc) {
        if (err) callback(err);
        else callback(null, doc);
      });
    },
    SNPs: function(callback) {
      Feature.find({
        type: /SNP/,
        startIdx: {$within: {$box: box}}
      }, function(err, doc) {
        if (err) callback(err);
        else callback(null, doc);
      });
    },
    features: function(callback) {
      Feature.find({
       startIdx: {$within: {$box: leftBox}}
      }, function(err, doc) {
        if (err) callback(err);
        else callback(null, doc);
      });
    },
    refseq: function(callback) {
      getRefRegion(region, function(err, data) {
        if (err) throw err;
        callback(null, data);
      });
    }
  },
  function(err, data) {
    if (err) console.log(err);
    data.region = region;
    callback(null, data);
  });
}

function getFeatureRegion(name, flank, callback) {
  Feature.find({
    "attributes.Name" : name
  }, function(err, doc) {
    if (err) callback(err);
    else if (doc.length === 0) callback(null, {});
    else {
      var start = doc[0].start - flank;
      start = start > 0 ? start : 0;
      var end = doc[0].end + flank;
      var chrom = doc[0].startIdx[0];
      callback(null, {start: start, end: end, chrom: chrom});
    }
  });
}

function annotateCodNCodSNPs() {
  
  async.waterfall([
    
    // get all CDSs in the database
    function(wfallCbk) {
      Feature.find({type: "CDS"}, wfallCbk);
    },
    
    // get all SNPs within CDSs
    function(CDSs, wfallCbk) {
      var codingSNPs = [];
      async.forEach(CDSs, function(cds, fEachCbk) {
        Feature.find({
          type: /SNP/,
          seqid: cds.seqid,
          start: {"$gte": cds.start},
          end: {"$lte": cds.end}
        }, function(err, snps) {
          if (err) {          
            throw err;
          }
          codingSNPs = codingSNPs.concat(snps);
          fEachCbk();
      });
      }, function() {
          wfallCbk(null, codingSNPs);
        });
    },
    function(codingSNPs, wfallCbk) {
      async.forEach(codingSNPs, function(snp, asyncCbk) {
        Feature.update(
          {start: snp.start},
          {"attributes.coding": true},
          function(err) {
           if (err) throw err;
           asyncCbk();
          }
        );
      }, function(err) {
        if (err) throw err;
        console.log("updated db");
      });
    }
  ]);
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
exports.getRegion = getRegion;
exports.getFeatureRegion = getFeatureRegion;
exports.onDbFilesChange = onDbFilesChange;
exports.getRefRegion = getRefRegion;
exports.importRefSeq = importRefSeq;
exports.annotateCodNCodSNPs = annotateCodNCodSNPs;
exports.getRefRegion = getRefRegion;
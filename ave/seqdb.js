var fs = require('fs');
var async = require('async');

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
    0: 0,
    1: 34.964571,
    2: 22.037565,
    3: 25.499034,
    4: 20.862711,
    5: 31.270811
};

function addFeatures(data, callback) {
    var flines = data.split('\n');
    var left = flines.length;
    flines.forEach(function(iLine) {
        if ((iLine[0] !== '#') && (iLine.length > 0)) {
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
            feature.startIdx = [ichrom, start / SCALE];
            feature.endIdx = [ichrom, end / SCALE];
            feature.score = farr[5];
            feature.strand = farr[6];
            feature.phase = farr[7];
            var attrarr = farr[8].split(';');
            feature.attributes = {};
            var i;
            for (i = 0; i < attrarr.length; ++i) {
                var attr = attrarr[i].split('=');
                var key = attr[0];
                var val = attr[1];
                feature.attributes[key] = val;
            }
            if (farr[2] !== 'chromosome') {
                var len = end - start;
                MAX_LEN = len > MAX_LEN ? len : MAX_LEN;
            }

            feature.save(function(err) {
                if (err) callback(err);
                if (--left === 0) callback(null, 'Features deployed in db.');
            });

        } else {
            if (--left === 0) callback(null, 'Features deployed in db.');
        }
    });
}

function makeLocusDb(callback) {
    async.series([

    function(seriesCallback) {
        Feature.find({
            type: 'gene'
        }, function(err, genes) {
            if (err) return seriesCallback(err);
            var left = genes.length;
            genes.forEach(function(gene) {
                locus = new Locus();
                locus.gene = gene;
                locus.startIdx = gene.startIdx;
                locus.endIdx = gene.endIdx;
                locus.save(function(err) {
                    if (err) return seriesCallback(err);
                    if (--left === 0) {
                        return seriesCallback(null, 'all loci created and saved');
                    }
                });
            });
        });
    }, function(seriesCallback) {
        Feature.find({
            type: 'mRNA'
        }, function(err, mRNAs) {
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
                        }, function(err, proteins) {
                            if (err) return parallelCallback(err);
                            return parallelCallback(null, proteins);
                        });
                    },
                    fivePrimeUTRs: function(parallelCallback) {
                        Feature.find({
                            type: 'five_prime_UTR',
                            'attributes.Parent': mRNAname
                        }, function(err, fivePrimeUTRs) {
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
                        }, function(err, CDSs) {
                            if (err) return parallelCallback(err);
                            return parallelCallback(null, CDSs);
                        });
                    },
                    exons: function(parallelCallback) {
                        Feature.find({
                            type: 'exon',

                        }, function(err, exons) {
                            if (err) return parallelCallback(err);
                            return parallelCallback(null, exons);

                        });
                    },
                    threePrimeUTRs: function(parallelCallback) {
                        Feature.find({
                            type: 'three_prime_UTR',
                            'attributes.Parent': mRNAname
                        }, function(err, threePrimeUTRs) {
                            if (err) return parallelCallback(err);
                            return parallelCallback(null, threePrimeUTRs);

                        });
                    }
                }, function(err, results) {
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
                    }, {
                        $push: {
                            geneModels: geneModel
                        }
                    }, function(err) {
                        if (err) return seriesCallback(err);
                        if (--left === 0) {
                            return seriesCallback(null, 'all mRNAs processed');
                        }
                    });
                });
            });
        });
    }], function(err, results) {
        if (err) return callback(err);
        return callback(null, "Creating loci db finished.");
    });
}

function getGffFiles(callback) {
    fs.readdir(DATA_DIR, function(err, files) {
        if (err) return callback(err);
        var gffFiles = [];
        var left = files.length;
        files.forEach(function(iFile) {
            if (iFile.slice(-4) === '.gff') {
                gffFiles.push(DATA_DIR + iFile);
            }
            if (--left === 0) {
                return callback(null, gffFiles);
            }
        });
    });
}
function importGff(callback) {
    async.waterfall([

    function(waterfallCallback) {
        getGffFiles(waterfallCallback);
    }, function(gffFiles, waterfallCallback) {
        var left = gffFiles.length;
        var gffData = '';
        gffFiles.forEach(function(iFile) {
            var dbFile = new DbFile();
            dbFile.file = iFile;
            dbFile.save(function(err) {
                if (err) throw err;
            });
            fs.readFile(iFile, 'utf8', function(err, data) {
                if (err) return waterfallCallback(err);
                gffData += data;
                if (--left === 0) return waterfallCallback(null, gffData);
            });
        });
    }, function(data, waterfallCallback) {
        addFeatures(data, waterfallCallback);
    // }, function(data, waterfallCallback) {
    //     makeLocusDb(waterfallCallback);
    }, function(data, waterfallCallback) {
        return callback(null, data);
    }]);
}

function onDbFilesAdded(files) {
  async.waterfall([
    function(wfallCbk) {
      // from all changed files take those with data (.fas .gff)
      async.filter(files, isDataFile, function(files) {
        // if the resulting array is empty just leave
        if (files.length <= 0) {
          console.log(" > There are no new data files.");
          return;
        }
        // else just pass data along the waterfall
        return wfallCbk(null, files);
      });
    },
    function(files, wfallCbk) {
      // filter out the list to new files
      async.filter(files, isNewFile, function(files) {
        // if no new files just leave
        if (files.length <= 0) {
          console.log(" > There are no new data files.");
          return;
        }
        // else pass data along the waterfall
        return wfallCbk(null, files);
      });
    },
    function(files, wfallCbk) {
      console.log(" > new files found: ");
      console.log(files);
      // create for each file an dbFile object
      async.map(files, newDbFile, function(err, dbFiles) {
        if (err) throw err;
        wfallCbk(null, dbFiles);
      });
    },
    function(dbFiles, wfallCbk) {
      // save files into a db and reload db
      async.parallel([
        function(paraCbk) {
          // save files to db
          async.forEach(dbFiles, function(f, feCbk) {
            f.save(feCbk);
          },paraCbk);
        },
        function(paraCbk) {
          console.log(" > reloading the db!");
          reloadDb(function(er, result) {
            console.log(result);
            console.log(" > Updated database");
            console.log(" > Please restart app to finish database update");
            paraCbk();
          });
        }],
        function(err, results) {
          if (err) throw err;
          wfallCbk(null, results);
        }
      );
    }
  ]);
}

function onDbFilesRemoved(files) {
  async.waterfall([
    function(wfallCbk) {
      // filter out non data files deleted
      async.filter(files, isDataFile, function(files) {
        // if the resulting array is empty just leave
        if (files.length <= 0) {
          console.log(" > There are no new data files.");
          return;
        }
        // else just pass data along the waterfall
        return wfallCbk(null, files);
      });
    },
    function(files, wfallCbk) {
      // remove from files list in db
      console.log(" > Data files have been removed:");
      console.log(files);
      async.parallel([
        function(paraCbk) {
        // remove files from db
        async.forEach(files, function(file, feCbk) {
          DbFile.remove({fpath: file}, feCbk);
        }, paraCbk);
        },
        function(paraCbk) {
          // reload db
          console.log(" > reloading the db!");
          reloadDb(function(er, result) {
            console.log(result);
            console.log(" > Updated database !");
            console.log(" > Please restart app to finish database update");
            paraCbk();
          });
        }
      ]);
    }
  ]);
}

function newDbFile(fname, callback) {
  fs.stat(fname, function(err, stats) {
    if (err) throw err;
    var dbFile = new DbFile();
    dbFile.fpath = fname;
    dbFile.stat = stats;
    return callback(null, dbFile);
  });
}

function isNewFile(fname, callback) {
  fs.stat(fname, function(err, stats) {
    if (err) throw err;
    DbFile.find({
      fpath: fname,
      'stat.mtime': stats.mtime
    }, function(err, data) {
      if (err) throw err;
      if (data.length <= 0) return callback(true);
      else return callback(false);
    });
  });
}

function isDataFile(fname, callback) {
  var gffPattern = /.gff/;
  var fastaPattern = /.fas/;
  if (gffPattern.test(fname) || fastaPattern.test(fname)){
    return callback(true);
  } else return callback(false);
}

function reloadDb(callback) {
    async.series([
    // first delete old data from databse
    function(seriesCallback) {
        var models = [Feature, Locus, GeneModel, DbFile];
        var left = models.length;
        models.forEach(function(model) {
            drop(model);
            if (--left === 0) {
              return seriesCallback(null, "Old data deleted from db.");
            }
        });
    },
    // read in gff files and put all the features into db
    function(seriesCallback) {
        async.parallel([
        importGff, importRefSeq], function(err, results) {
            if (err) throw err;
            seriesCallback(null, "data imported");
        });
    }, function(seriesCallback) {
        annotateCodNCodSNPs(function(err) {
            if (err) throw err;
            seriesCallback(null, "SNPs annotated");
        });
    }], function(err, results) {
        if (err) callback(err);
        return callback(null, results);
    });
}

function importRefSeq(callback) {
  // pattern for getting position of the seq in fasta file
  // assumes pattern (Chr1:1..1000)
  var chunk = 1000;
  console.log(" > importing fasta");

  async.waterfall([
    function(wfallCbk){
      fs.readdir(DATA_DIR, wfallCbk);
    },
    function(files, wfallCbk) {
      async.filter(files,
        function(iFile, filterCbk) {
          var fastaPattern = /.fas/;
          return filterCbk(fastaPattern.test(iFile));
        },
        function(fastaFiles) {
          return wfallCbk(null, fastaFiles);
        }
      );
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
  async.waterfall([
    function(wfCbk) {
      // get all those that start within region
      RefSeq.find({
        chrom: region.chrom,
        $or: [
          {starts: {"$gte": region.start, "$lte": region.end}},
          {ends: {"$gte": region.start, "$lte": region.end}},
          {
            starts: {"$lte": region.start},
            ends: {"$gte": region.end}
          }
        ]
      }, wfCbk);
    },
    function(fragments, wfCbk) {
      async.sortBy(fragments, function(fragment, sortCbk) {
          return sortCbk(null, fragment.starts);
        },wfCbk);
    },
    function(fragments, wfCbk) {
      async.reduce(fragments, "", function(memo, fragment, redCbk) {
        return redCbk(null, memo += fragment.sequence);
      }, function(err, refseq) {
        if (err) throw err;
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

function drop(model) {
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
    }
  );
}

function getRegion(region, callback) {
  async.parallel({
    features: function(callback) {
      getFeatures(region, callback);
    },
    refseq: function(callback) {
      getRefRegion(region, function(err, data) {
        if (err) throw err;
        callback(null, data);
      });
    }
  },
  function(err, data) {
    if (err) throw err;
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

function annotateCodNCodSNPs(callback) {

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
        callback(null);
      });
    }
  ]);
}

function getFeatures(region, callback) {
  var chrStr = "Chr" + region.chrom;
  var regionQuery = {
    start: {$lte: region.end},
    end: {$gte: region.start},
    seqid: {$regex: chrStr}
  };

  Feature.find(regionQuery, callback);
}

exports.addFeatures = addFeatures;

////////////////////
exports.getFromRegion = getFromRegion;
exports.Feature = Feature;
exports.reloadDb = reloadDb;
exports.getRegion = getRegion;
exports.getFeatureRegion = getFeatureRegion;
exports.onDbFilesAdded = onDbFilesAdded;
exports.onDbFilesRemoved = onDbFilesRemoved;
exports.getRefRegion = getRefRegion;
exports.importRefSeq = importRefSeq;
exports.annotateCodNCodSNPs = annotateCodNCodSNPs;
exports.getFeatures = getFeatures;
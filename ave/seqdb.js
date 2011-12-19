var fs = require('fs');
var async = require('async');

var models = require('./models');


var Feature = models.Feature;
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

function addFeatures(lines) {
    async.forEach(lines, function(line, fEachCbk) {
        var farr = line.split('\t');
        if ((line[0] == '#') || (farr.length !== 9)) {
            return fEachCbk();
        }
        var feature = new Feature();
        feature.seqid = farr[0];
        feature.source = farr[1];
        feature.type = farr[2];
        var start = parseInt(farr[3], 10);
        var end = parseInt(farr[4], 10);
        feature.start = start;
        feature.end = end;
        feature.score = farr[5];
        feature.strand = farr[6];
        feature.phase = farr[7];
        var attrString = farr[8].split(';');
        feature.attributes = {};
        async.reduce(attrString, {}, function(memo, item, reduceCbk) {
            var attr = item.split('=')
            memo[attr[0]] = attr[1];
            reduceCbk(null, memo)
        }, function(err, attributes) {
            feature.attributes = attributes;
            feature.save(function(err) {
                if (err) {
                    console.log("error while saving feature");
                    console.log(err);
                    return fEachCbk(err);
                }
                console.log('> Feature at: ' + feature.seqid + ": " + feature.start);
                return fEachCbk();
            });
        })
    }, function(err){
        if (err) {
            console.log('Error while importing featres');
            throw err;
        }
        console.log('> imported chunk');
    });
}

function getGffFiles(callback) {
    fs.readdir(DATA_DIR, function(err, files) {
        if (err) {return callback(err);}
        async.reduce(files, [], function(memo, file, reduceCbk) {
            if (file.slice(-4) === '.gff') {
                memo.push(DATA_DIR + file);
            }
            reduceCbk(null, memo)
        }, function(err, gffFiles) {
            if (err) { callback(err);}
            callback(null, gffFiles);
        });
    });
}

function importGff(callback) {
    async.waterfall([
        function(wfallCbk) {
            getGffFiles(wfallCbk);
        }, function(gffFiles, wfallCbk) {
            async.forEachLimit(gffFiles, 15, function(iFile, fEachCbk) {
                console.log('> Importing file ' + iFile);
                var dbFile = new DbFile();
                dbFile.file = iFile;
                dbFile.save(function(err) {
                    if (err) {throw err;}
                });
                var readStream = fs.createReadStream(iFile);
                var dataString = '';
                readStream.on('data', function(chunk) {
                    dataString += chunk;
                    var fullSplit = dataString.split('\n');
                    var data = fullSplit.slice(0, fullSplit.length-1);
                    dataString = fullSplit.slice(fullSplit.length-1);
                    addFeatures(data);
                });
                readStream.on('error', function(err) {
                    console.log('Error while reading file stream.');
                    fEachCbk(err);
                });
                readStream.on('end', function() {
                    fEachCbk();
                })
            }, function(err) {
                if (err) {wfallCbk(err);}
                wfallCbk(null, '> Finished importing GFF data.');
            });
        }, function(message, wfallCbk) {
            console.log(message);
            return callback(null, message);
        }
    ]);
}

function newDbFile(fname, callback) {
    fs.stat(fname, function(err, stats) {
        if (err) {throw err;}
        var dbFile = new DbFile();
        dbFile.fpath = fname;
        dbFile.stat = stats;
        return callback(null, dbFile);
    });
}

function isNewFile(fname, callback) {
    fs.stat(fname, function(err, stats) {
        if (err) {throw err;}
        DbFile.find({
            fpath: fname,
            'stat.mtime': stats.mtime
        }, function(err, data) {
            if (err) {throw err;}
            if (data.length <= 0) {return callback(true);}
            else {return callback(false);}
        });
    });
}

function isDataFile(fname, callback) {
    var gffPattern = /.gff/;
    var fastaPattern = /.fas/;
    if (gffPattern.test(fname) || fastaPattern.test(fname)){
        return callback(true);
    } else {return callback(false);}
}

function fastaLines2RefSeq(fastalines, callback) {
    var chunk = 10000;
    var locPattern = /^>(Chr\w+):(\d+)\.\.(\d+)/;
    var chromPattern = /^>(Chr\w+)/;
    var refSeq = new RefSeq();
    var chrom, starts, ends;
    async.forEachSeries(fastalines, function(line, fEachSerCbk) {
        //if matches header get header data
        var locMatch = line.match(locPattern);
        var chromMatch = line.match(chromPattern);

        if (chromMatch) {
            refSeq = new RefSeq();
            refSeq.chrom = chromMatch[1];
            refSeq.starts = 1;
            if (locMatch) {
                refSeq.starts = parseInt(locMatch[2], 10);
                refSeq.ends = parseInt(locMatch[3], 10);
            }
            refSeq.sequence = '';
        } else {refSeq.sequence += line;}

        if (refSeq.sequence.length >= chunk) {
            var newRefSeq = new RefSeq();
            newRefSeq.chrom = chrom;
            newRefSeq.sequence = refSeq.sequence.slice(chunk + 1);
            refSeq.sequence = refSeq.sequence.slice(0, chunk);
            refSeq.ends = refSeq.starts + refSeq.sequence.length - 1;
            newRefSeq.starts = refSeq.ends + 1;
            refSeq.save(function(err) {
                if (err) {
                    console.log(refSeq);
                    console.log('error while saving reference seq');
                    throw err;
                }
                refSeq = newRefSeq;
                fEachSerCbk();
            });
        } else {fEachSerCbk();}
    }, function(err) {
        if (err) {callback(err);}
        callback(null);
    });
}

function importRefSeq(callback) {
    // pattern for getting position of the seq in fasta file
    // assumes pattern (Chr1:1..1000)
    console.log(' > importing fasta');

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
            // concatenate data from all fasta files
            async.forEachSeries(fastaFiles, function(iFile, fEachCbk) {
                console.log('> Reading ' + iFile)
                fs.readFile(DATA_DIR + iFile, 'utf8', function(err, data) {
                    if (err) {throw err;}
                    var lines = data.split('\n');
                    fastaLines2RefSeq(lines, fEachCbk);
                });
            }, function() {
                wfallCbk(null, '> Finished importing fasta data.');
            });
        },
        function(message, wfallCbk) {
            console.log(message);
            callback();
        }
    ]);
}

function drop(model) {
//    model.collection.drop();
}

function updateSNPs(CDSs, callback) {
    async.forEachLimit(CDSs, 64, function(cds, fEachCbk) {
        console.log('> fetching snps at: ' + cds.seqid + ":" + cds.start + ".." + cds.end);
        Feature.update({
            type: /SNP/,
            seqid: cds.seqid,
            start: {$gte: cds.start, $lte: cds.end}
        },
        {'attributes.coding': true},
        function(err) {
            if (err) {
                throw err;
            }
            fEachCbk();
        });
    }, function(err) {
        if (err) {
        console.log('> Error while iterating over cdss');
        throw err;
        }
        callback(null);
    })
}

function annotateCodNCodSNPs(callback) {
    console.log('> annotating coding SNPs');
    var docBuffer = 1024;
    var stream = Feature
    .where('type', 'CDS')
    .select('seqid', 'start', 'end')
    .stream();
    var docs = [];
    stream.on('data', function(doc) {
        docs.push(doc);
        if (docs.lenght >= docBuffer) {
            stream.pause();
            updateSNPs(docs, function(err) {
                if (err) {
                throw err;
                }
                stream.resume()
            });
            docs = [];
        }
    })

    stream.on('error', function(err){
        console.log("! Error while fetching CDS data");
        throw err;
    })

    stream.on('close', function() {
        if (docs.length > 0) {
            updateSNPs(docs, callback );
        }
    })
}

function reloadDb(callback) {
    async.series([
        // first delete old data from databse
        function(seriesCallback) {
            var models = [DbFile, Feature, RefSeq];
            var left = models.length;
            models.forEach(function(model) {
                drop(model);
                if (--left === 0) {
                    return seriesCallback(null, 'Old data deleted from db.');
                }
            });
        },
        // read in gff files and put all the features into db
        function(seriesCallback) {
            async.series([
                importRefSeq, importGff], function(err, results) {
                    if (err) {throw err;}
                    seriesCallback(null, 'data imported');
                });
        }, function(seriesCallback) {
            console.log('> Annotating SNPs');
            annotateCodNCodSNPs(function(err) {
                if (err) {throw err;}
                seriesCallback(null, 'SNPs annotated');
            });
        }], function(err, results) {
            if (err) {callback(err);}
            return callback(null, results);
        });
}

function onDbFilesAdded(files) {
    async.waterfall([
        function(wfallCbk) {
            // from all changed files take those with data (.fas .gff)
            async.filter(files, isDataFile, function(files) {
                // if the resulting array is empty just leave
                if (files.length <= 0) {
                    console.log(' > There are no new data files.');
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
                    console.log(' > There are no new data files.');
                    return;
                }
                // else pass data along the waterfall
                return wfallCbk(null, files);
            });
        },
        function(files, wfallCbk) {
            console.log(' > new files found: ');
            console.log(files);
            // create for each file an dbFile object
            async.map(files, newDbFile, function(err, dbFiles) {
                if (err) {throw err;}
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
                    console.log(' > reloading the db!');
                    reloadDb(function(er, result) {
                        console.log(result);
                        console.log(' > Updated database');
                        console.log(' > Please restart app to finish database update');
                        paraCbk();
                    });
                }],
                function(err, results) {
                    if (err) {throw err;}
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
                    console.log(' > There are no new data files.');
                    return;
                }
                // else just pass data along the waterfall
                return wfallCbk(null, files);
            });
        },
        function(files, wfallCbk) {
            // remove from files list in db
            console.log(' > Data files have been removed:');
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
                    console.log(' > reloading the db!');
                    reloadDb(function(er, result) {
                        console.log(result);
                        console.log(' > Updated database !');
                        console.log(' > Please restart app to finish database update');
                        paraCbk();
                    });
                }
            ]);
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
                    {starts: {'$gte': region.start, '$lte': region.end}},
                    {ends: {'$gte': region.start, '$lte': region.end}},
                    {
                        starts: {'$lte': region.start},
                        ends: {'$gte': region.end}
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
        start: {$lte: region.end},
        end: {$gte: region.start},
        seqid: {$regex: region.chrom}
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

function getGeneModels(region, callback) {
    var chrStr = 'Chr' + region.chrom;
    var regionQuery = {
        start: {$lte: region.end},
        end: {$gte: region.start},
        seqid: {$regex: chrStr},
        type: { $in: ['gene', 'CDS', 'three_prime_UTR', 'five_prime_UTR'] }
    };

    Feature.find(regionQuery, function(err, data) {
        if (err) {throw err;}
        return callback(null, {region: region, features: data});
    });
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

exports.addFeatures = addFeatures;

////////////////////
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
exports.getGeneModels = getGeneModels;

var fs = require('fs');
var Step = require('step');
var async = require('async');

var models = require('./models');

var Feature = models.Feature;
var GeneModel = models.GeneModel;
var Locus = models.Locus;

var home = process.cwd() + '/data/';
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
			// console.log(feature);
            if (farr[2] !== 'chromosome') {
				var len = end - start;
				MAX_LEN = len > MAX_LEN ? len : MAX_LEN;
			};

			feature.save(function(err){
				if (err) callback(err);
                if (--left === 0) callback(null);
            });
			
		} else --left;

	}); 
}

function makeLocusDb(){
	async.series([
		function(callback) {
			console.log('getting genes')
            Feature.find({type: 'gene'}, function(err, genes) {
				if (err) callback(err);
                console.log('got genes');
				var left = genes.length;
				genes.forEach(function(gene, left) {
					locus = new Locus;
					locus.gene = gene;
                    locus.start = gene.start;
                    locus.end = gene.end;
					locus.save(function(err) {
						if (err) callback(err);
						if(--left === 0) {
						callback(null, 'all loci created and saved');
						}
					});
				});				
			});
		},
        function(callback) {
                console.log('getting mRNAs');
                Feature.find({
                type: 'mRNA'
                }, function(err, mRNAs){
                    console.log('got mRNAs');
                    if (err) return callback(err);
                    var left = mRNAs.length;
                    mRNAs.forEach(function(mRNA){
                        var mRNAparent = mRNA.attributes.Parent;
                        var mRNAname = mRNA.attributes.Name;
                        async.parallel({
                            proteins: function(parallelCallback) {
                                Feature.find({
                                type: 'protein',
                                "attributes.Derives_from": mRNAname 
                                }, function(err, proteins){
                                    if(err) return parallelCallback(err);
                                    return parallelCallback(null, proteins);
                                });    
                            },
                            fivePrimeUTRs: function(parallelCallback) {
                                Feature.find({
                                    type: 'five_prime_UTR',
                                    'attributes.Parent': mRNAname
                                }, function(err, fivePrimeUTRs) {
                                   if(err) return parallelCallback(err);
                                   return parallelCallback(null, fivePrimeUTRs);
                                });
                            },
                            CDSs: function(parallelCallback) {
                                Feature.find({
                                    type: 'CDS',
                                    'attributes.Parent': {$regex: mRNAname}
                                }, function(err, CDSs) {
                                    if(err) return parallelCallback(err);
                                    return parallelCallback(null, CDSs);
                                });
                            },
                            exons: function(parallelCallback) {
                                Feature.find({
                                    type: 'exon',
                                    'attributes.Parent': mRNAname
                                }, function(err, exons) {
                                    if(err) return parallelCallback(err);
                                    return parallelCallback(null, exons);

                                });
                            },
                            threePrimeUTRs: function(parallelCallback) {
                                Feature.find({
                                    type: 'three_prime_UTR',
                                    'attributes.Parent': mRNAname
                                }, function(err, threePrimeUTRs) {
                                    if(err) return parallelCallback(err);
                                    return parallelCallback(null, threePrimeUTRs);

                                });
                            }
                        }, function(err, results){
                            if(err) return parallelCallback(err);
                            var geneModel = new GeneModel;
                            geneModel.mRNA = mRNA;
                            geneModel.protein = results.proteins;
                            geneModel.fivePrimeUTRs = results.fivePrimeUTRs;
                            geneModel.CDSs = results.CDSs;
                            geneModel.exons = results.exons;
                            geneModel.threePrimeUTRs = results.threePrimeUTRs;

                            Locus.update({
                                "gene.attributes.Name": mRNAparent
                            }, {$push: {geneModels: geneModel}}, function(err) {
                                if(err) return callback(err);
                                console.log("saved model: " + mRNA.attributes.Name);
                                if (--left === 0) return (callback(null, 'all mRNAs processed'))
                            });
                        });
                    })
                });   
            }   
	    ],
		function(err, results){
			if (err) throw err;
			console.log(results);
		}
	);
}

function getLoci(){
}

function processGenes(err, genes) {
	if (err) {throw err;};
	genes.forEach(function(gene){
		var locus = new Locus;
		locus.gene = gene;
		locus.start = gene.start;
		locus.end = gene.end;
		console.log(gene.attributes.Name);
		var name = gene.attributes.Name;
	
		Feature.find({type: "mRNA", "attributes.Parent": name},
									function(err, mRNAs) {
										if (err) {throw err;};
										console.log('my RNAs with name : '+ name + ' are: ' + mRNAs);
										processRNAs(mRNAs, locus, function(){
											locus.save(function(err) {
												if(err) {throw err;};
											});
										});
									});
	});
	
}

function processRNAs(mRNAs, locus, callback){
	locus.geneModels = [];

	var left = mRNAs.length;
	console.log('there are: ' + left + ' mRNAs');
	mRNAs.forEach(function(mRNA){
		geneModel = new GeneModel;
		fillInModel(mRNA, geneModel, function (gm){
			console.log("protein in callback: " + geneModel.protein);
			locus.geneModels.push(gm);
		});
		if (--left === 0) {
			callback();
		}
	});

}

function fillInModel(mRNA, geneModel, pushModel){
	
	// geneModel.mRNA = mRNA;
	var name = mRNA.attributes.Name;
	
	async.parallel({
		protein: function(callback){
			Feature.find({type: "protein", "attributes.Derives_from": name}, callback);
		},
		fivePrimeUTRs: function(callback) {
			Feature.find({type: "five_prime_UTR", "attributes.Parent": name}, callback);			
		}
	},
	function(err, results) {
		console.log("in clbkfunc: " + geneModel);
		console.log("protein: " + results.protein);
		console.log("utr: " + results.fivePrimeUTRs);
		geneModel.protein.push(results.protein);
		geneModel.mRNA = mRNA;
		pm();
	});
	function pm (){
		pushModel(geneModel);
	}
}

function putProtein(geneModel, parentName) {
	Feature.find({type: "protein", "attributes.Derives_from": parentName},
		function(err, proteins) {
			if (err) {throw err;};
			geneModel.protein = proteins[0];
		});
}

function putFivePrimeUTRs(geneModel, parentName) {
	Feature.find({type: "five_prime_UTR", "attributes.Parent": parentName},
		function(err, utrs) {
			if(err){throw err;};
			utrs.forEach(function(utr){
				geneModel.fivePrimeUTRs.push(utr);
			});
		});
}

function getGffFiles(files, callback){
	// loop over files and get .gff ones
	var gffFiles = [];
	var left = files.length;
	
	files.forEach(function(iFile) {
		
		if (iFile.slice(-4) === '.gff') {
			gffFiles.push(iFile);
		}
		
		if (--left === 0 ) {
			callback(null, gffFiles);
			}
	});
}

function reloaddb(callback){
	// get a list of all files in data dir
	fs.readdir(home, function (err, files) {
			getGffFiles(files, function(err, gffFiles){
			
			var left = gffFiles.length;
			gffFiles.forEach(function (iFile) {
				var fpath = home + iFile;
				fs.readFile(fpath, 'utf-8', function(err, data) {
					if (err) throw err;
	                addFeatures(data, function(err) {
						if (err) {
							console.log('Could not load data into database:');						
							throw err;
						};
                        console.log('import completed');
					});
				});
			});
		});
	});
	return callback(null);
}

function drop(model) {
	//var model = mongoose.model(model);
	model.collection.drop();
}
// loc should be {chrom: ,start: ,stop: }
function getFromRegion(model, type, loc) {
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
			if (err) { throw err;};
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

function testdb2() {
	reloaddb(function(err) {
        if(err) throw err;
	});
} 

function testdb3() {
	drop(Feature);
	drop(Locus);
	drop(GeneModel);
}

function testdb4() {
	getFromRegion(Feature, 'protein', {chrom: 1, start: 100, end: 3800});
}

function testdb5() {	
	makeLocusDb();
	console.log('in testdb5');
}

testdb5();

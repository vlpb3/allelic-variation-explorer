var fs = require('fs');

var home = process.cwd() + '/data/';
var MAX_LEN = 0;
var SCALE = 1000000;

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/seqdb');

var Schema = mongoose.Schema;

var FeatureSchema = new Schema({
	seqid: String,
	source: String,
	type: {type: String},
	start: {},
	end: {},
	score: String,
	strand: {type: String},
	phase: {type: String},
	attributes: {}
}).index({start: '2d'})
	.index({end: '2d'});

mongoose.model('Feature', FeatureSchema);

var Feature = mongoose.model('Feature');

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
			console.log(farr);
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
	
			feature.save(function(err){
				if (err){callback(err);}
			});
			
			if (farr[2] !== 'chromosome') {
				var len = end - start;
				MAX_LEN = len > MAX_LEN ? len : MAX_LEN;
				console.log('maximum length: ' + MAX_LEN);
			}
		}

		if (--left === 0) {
			console.log('added data');
			callback(null);
			};
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
					if (err) {
						throw err;
					};
					addFeatures(data, function(err) {
						if (err) {
							console.log('Could not load data into database:');						
							console.log(err);
						} else {
							console.log('data loaded into database');
						};
					});
					console.log('data in ' + iFile + ' :\n' + data);
					if (--left === 0) {
						console.log('finished reading data');
					};
				});
			});
		});
	});
	return callback(null);
}

function drop(model) {
	var model = mongoose.model(model);
	model.collection.drop();
}
// loc should be {chrom: ,start: ,stop: }
function getFromRegion(model, type, loc) {
	var model = mongoose.model(model);
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
			if (err) {console.log(err);};
			console.log(doc);
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
		console.log('run callbackdb');
	});
} 

function testdb3() {
	drop('Feature');
}

function testdb4() {
	getFromRegion('Feature', 'CDS', {chrom: 1, start: 100, end: 3800});
}

testdb4();
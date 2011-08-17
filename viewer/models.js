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


var mRNASchema = new Schema({
	protein: {},
	fivePrimeUTR: {},
	CDSs: [FeatureSchema],
	exons: [FeatureSchema],
	threePrimeUTR: {}
});

mongoose.model('MRNA', mRNASchema);


var LocusSchema = new Schema({
	start: {},
	end: {},
	gene: {},
	mRNAs: [FeatureSchema]
}).index({start: '2d'})
	.index({end: '2d'});

mongoose.model('Locus', LocusSchema);

var Feature = mongoose.model('Feature');
var MRNA = mongoose.model('MRNA');
var Locus = mongoose.model('Locus');

exports.Feature = Feature;
exports.MRNA = MRNA;
exports.Locus = Locus;
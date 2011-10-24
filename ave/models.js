var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/seqdb');

var Schema = mongoose.Schema;

var FeatureSchema = new Schema({
	seqid: String,
	source: String,
	type: {type: String},
	start: Number,
	end: Number,
	startIdx: {},
	endIdx: {},
	score: String,
	strand: {type: String},
	phase: {type: String},
	attributes: {}
}).index({startIdx: '2d'})
	.index({endIdx: '2d'});

mongoose.model('Feature', FeatureSchema);

var GeneModelSchema = new Schema({
	mRNA: {},
	protein: [FeatureSchema],
	fivePrimeUTRs: [FeatureSchema],
	CDSs: [FeatureSchema],
	exons: [FeatureSchema],
	threePrimeUTRs: [FeatureSchema],
	introns: {}
});

mongoose.model('GeneModel', GeneModelSchema);

var LocusSchema = new Schema({
	startIdx: {},
	endIdx: {},
	gene: {},
	geneModels: [GeneModelSchema]
}).index({startIdx: '2d'})
	.index({endIdx: '2d'});

mongoose.model('Locus', LocusSchema);

var DbFileSchema = new Schema({
  file: String
});

mongoose.model('DbFile', DbFileSchema);

var Feature = mongoose.model('Feature');
var GeneModel = mongoose.model('GeneModel');
var Locus = mongoose.model('Locus');
var DbFile = mongoose.model('DbFile');

exports.Feature = Feature;
exports.GeneModel = GeneModel;
exports.Locus = Locus;
exports.DbFile = DbFile;
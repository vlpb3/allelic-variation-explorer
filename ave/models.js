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
  fpath: String,
  stat: {
  	dev: Number,
  	ino: Number,
  	mode: Number,
  	nlink: Number,
  	uid: Number,
  	gid: Number,
  	rdev: Number,
  	size: Number,
  	blksize: Number,
  	blocks: Number,
  	atime: {},
  	mtime: {},
  	ctime: {}
  }
});
mongoose.model('DbFile', DbFileSchema);

var RefSeqSchema = new Schema({
  chrom: Number,
  starts: Number,
  ends: Number,
  startIdx: {},
  endIdx: {},
  sequence: String
}).index({startIdx: '2d'})
  .index({endIdx: '2d'});
mongoose.model('RefSeq', RefSeqSchema);

var Feature = mongoose.model('Feature');
var GeneModel = mongoose.model('GeneModel');
var Locus = mongoose.model('Locus');
var DbFile = mongoose.model('DbFile');
var RefSeq = mongoose.model('RefSeq');

exports.Feature = Feature;
exports.GeneModel = GeneModel;
exports.Locus = Locus;
exports.DbFile = DbFile;
exports.RefSeq = RefSeq;
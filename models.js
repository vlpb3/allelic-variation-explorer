var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/seqdb');

var Schema = mongoose.Schema;

var FeatureSchema = new Schema({
  seqid: { type: String },
  source: {type: String},
  type: {type: String},
  start: {type: Number},
  end: {type: Number},
  score: String,
  strand: {type: String},
  phase: {type: String},
  attributes: {}
});

mongoose.model('Feature', FeatureSchema);

var RefSeqSchema = new Schema({
  chrom: {type: String},
  starts: {type: Number},
  ends: {type: Number},
  sequence: String
});
mongoose.model('RefSeq', RefSeqSchema);

var StrainSchema = new Schema({
  strainList: []  
});
mongoose.model('Strain', StrainSchema);

var Feature = mongoose.model('Feature');
var RefSeq = mongoose.model('RefSeq');
var Strain = mongoose.model('Strain');

exports.Feature = Feature;
exports.RefSeq = RefSeq;
exports.Strain = Strain;

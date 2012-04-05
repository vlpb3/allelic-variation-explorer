var async = require('async');
var mongoose = require('mongoose');

var defaultRef = 'TAIR9';
var defCon = mongoose.createConnection('mongodb://localhost/' + defaultRef);
var metaCon = mongoose.createConnection('mongodb://localhost/meta');

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
defCon.model('Feature', FeatureSchema);

var RefSeqSchema = new Schema({
  chrom: {type: String},
  starts: {type: Number},
  ends: {type: Number},
  sequence: String
});
defCon.model('RefSeq', RefSeqSchema);

var StrainSchema = new Schema({
  strainList: []  
});
defCon.model('Strain', StrainSchema);


var RefListSchema = new Schema({
  list: []
});
metaCon.model('RefList', RefListSchema);

function registerModels(reflist, clbk){
  async.forEach(reflist, function (refname) {
    var connection = mongoose.createConnection('mongodb://localhost/' + refname);
    connection.model('Feature', FeatureSchema);
    connection.model('RefSeq', RefSeqSchema);
    connection.model('Strain', StrainSchema);
  }, clbk);
}

var Feature = defCon.model('Feature');
var RefSeq = defCon.model('RefSeq');
var Strain = defCon.model('Strain');
var RefList = metaCon.model('RefList');

exports.Feature = Feature;
exports.RefSeq = RefSeq;
exports.Strain = Strain;
exports.RefList = RefList;
exports.registerModels = registerModels;

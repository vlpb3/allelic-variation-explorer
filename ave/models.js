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
        chrom: {type: String},
        starts: {type: Number},
        ends: {type: Number},
        sequence: String
    });
    mongoose.model('RefSeq', RefSeqSchema);

    var Feature = mongoose.model('Feature');
    var DbFile = mongoose.model('DbFile');
    var RefSeq = mongoose.model('RefSeq');

    exports.Feature = Feature;
    exports.DbFile = DbFile;
    exports.RefSeq = RefSeq;

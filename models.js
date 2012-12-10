"use strict";

// imports
var async = require('async');
var mongoose = require('mongoose');

// open database connection
var dbConnection = mongoose.createConnection('mongodb://localhost/seqdb');
var Schema = mongoose.Schema;

// define schema for stiring feature data as they ar in gff3 format
var FeatureSchema = new Schema({
    seqid: {type: String},
    source: {type: String},
    type: {type: String},
    start: {type: Number},
    end: {type: Number},
    score: String,
    strand: {type: String},
    phase: {type: String},
    attributes: {}
});
dbConnection.model('Feature', FeatureSchema);

// define schema for storing reference sequence imported from fasta file
var RefSeqSchema = new Schema(
  {
    genome: {type: String},
    chrom: {type: String},
    starts: {type: Number},
    ends: {type: Number},
    sequence: String
});
dbConnection.model('RefSeq', RefSeqSchema);

// define schema for storing list of accessions/strains for each genome
var GenomeStrainsSchema = new Schema(
  {
    genome: {type: String},
    strains: [String]
  });
dbConnection.model('genomestrains', GenomeStrainsSchema);

// define schema for storing chromInfo
var ChromInfoSchema = new Schema(
  {
    genome: {type: String},
    chromosomes: {}
  }
);
dbConnection.model('chromInfo', ChromInfoSchema);

exports.dbConnection = dbConnection;

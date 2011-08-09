var mongoose = require('mongoose');
var db = mongoose.createConnection('mongodb://localhost/db');

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var Feature = new Schema(
	{
		seqid: String,
		source: String,
		type: {type: String},
		start: Number,
		end: Number,
		score: Number,
		strand: String,
		phase: String,
		attributes: {
			ID: String,
			Name: String,
			Alias: String,
			Parent: String,
			Target: String,
			Gap: String,
			Dervies_from: String,
			Note: String,
			Dbxref: String,
			Ontology_term: String,
		},
		loc: Array,
	})

var Feature = mongoose.model("Feature");

var mongoose = require('mongoose');

Schema = mongoose.Schema;

var FeatureSchema = new Schema({
	name: String,
	start: {},
	end: {},
}).index({start: '2d'}).index({end: '2d'});

mongoose.connect('mongodb://localhost/mydb');

mongoose.model('Feature', FeatureSchema);

var Feature = mongoose.model('Feature');

var feature = new Feature();
feature.name = "snp6";
feature.start = [1, 100];
feature.end = [1, 150];
feature.save(function(err){
	if (err){throw err;}
	console.log('saved');
	// mongoose.disconnect()
});
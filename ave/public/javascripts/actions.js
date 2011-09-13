$(document).ready(function(){
	var SCALE = 1000000;
	var loc = {
		chrom: 1,
		buff_start: 0,
		buff_end: 3000,
		start: 73,
		end: 1000,
		old_start: 0,
		old_end: 0,
		span: 927,
		update: function(new_loc) {
			this.old_start = this.buff_start;
			this.old_end = this.buff_end;
			var that = this;
			var params = Object.keys(new_loc);
			params.forEach(function(param) {
				that[param] = new_loc[param];
			});
			this.span = this.end - this.start;
			this.buff_start = (this.start - 2*this.span) >= 0 ? (this.start - 2*this.span) : 0;
			this.buff_end = this.end + 2*this.span;
			data.update();
		}	
	};
	var socket = io.connect('http://localhost');
	var data =  {
		buff_loci: [],
		buff_SNPs: [],
		loci: [],
		SNPs: [],
		haplotypes: {},
		update: function(){
			if (viewIsInBuffer()) {
				
			}
			else {
				
			}
		},
		updateData: function(){
			this.features = [];
			this.SNPs = [];
			for (var i=0; i<buff_loci.length; i++) {
				var feature = buff_loci[i];
				if (isInView(feature, loc)) this.features.push(feature);
			};
			for (var i=0; i<buff_SNPs.length; i++) {
				var SNP = buff_SNPs[i];
				if (isInView(SNP, loc)) this.SNPs.push(feature);
			};
		}
	};
	
	var viewIsInBuffer = function() {
		if ( ( (loc.start - loc.old_start) > 0 ) &&
			( (loc.end - loc.old_end) < 0 ) ) return true;
		else return false;
	};
	
	var isInView = function(feature, loc) {
		f_start = feature.start[1] * SCALE;
		f_end = feture.end[1] * SCALE;
		if ( (f_end >= loc.start) && (f_start <= loc.end) ) return true;
		else return false;
	};

	var getHaplotypes = function(SNPs) {
		var strains = getStrains(SNPs);
		
	};
	
	var getStrains = function(SNPs) {
		var refStrain = [];
		var strains = {};
		SNPs.forEach(function(SNP) {
			var pos = SNP.start[1]*SCALE;
			var base = SNP.attributes.Change.split(':')[0];
			var variant = SNP.attributes.Change.split(':')[1];
			var strain = SNP.attributes.strain;
			refStrain[pos] = base;
			if (stains[strain]) srtrains[strain][pos] = variant;
			else {
				strains[strain] = [];
				strains[strain][pos] = variant;
			}
		});
		return Strains;
	};
	
	
	// reloading db on settings click
	$("#settings").click(function() {
		console.log("settings clicked");
		socket.emit('reloadDb');
	});
	$("#start").change(function() {
		var start = parseInt($('#start').val(), 10);
		console.log("start is : " + start);
		loc.update({start: start});
		console.log(loc);
	});

});

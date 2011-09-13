$(document).ready(function(){
	
	var socket = io.connect('http://localhost');
	
	var ave = {};
	ave.bufferSize = 5;
	ave.start = parseInt($('#start').val(), 10);
	ave.end = parseInt($('#end').val(), 10);
	ave.chrom = parseInt($('#chrom').val().split('Chrom')[1], 10);
	ave.span = ave.end - ave.start;
	ave.bufferFlankSize = ave.span * (ave.bufferSize-1)/2;
	
	ave.bufferDb = {
		start: ( (ave.start - ave.bufferFlankSize) >= 0 ) ?
			(ave.start - ave.bufferFlankSize) : 0,
		end: ave.end + ave.bufferFlankSize,
		chrom: ave.chrom
	};
	ave.updateBufferDb = function() {
			var region = {};
			region.start = ave.bufferDb.start;
			region.end = ave.bufferDb.end;
			region.chrom = ave.bufferDb.chrom;
			socket.emit("getData", region);
	};
	ave.viewDb = {};
		


	
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
		getFirst: function() {
			//get data at application start
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
	
	var getData = function(region, callback){
		var req_region = region;
		socket.emit('getData', req_region);
		socket.on('data', function(region, data){
		
		});
	};
	
	// reloading db on settings click
	$("#settings").click(function() {
		console.log("settings clicked");
		socket.emit('reloadDb');
	});
	$("#start").change(function() {	
		ave.updateBufferDb();

	});

});

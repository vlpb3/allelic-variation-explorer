var ave = {};

$(document).ready(function(){
	
	var socket = io.connect('http://localhost');
	
	ave.bufferSize = 5;
	ave.start = parseInt($('#start').val(), 10);
	ave.end = parseInt($('#end').val(), 10);
	ave.chrom = parseInt($('#chrom').val().split('Chr')[1], 10);
	ave.span = ave.end - ave.start;
	ave.bufferFlankSize = ave.span * (ave.bufferSize-1)/2;
	
	ave.updateDb = function() {
		if ( (ave.end >= ave.bufferDb.start) && (ave.end <= ave.bufferDb.end) )
			ave.updateViewDb();
		else ave.viewDb.waiting = true;
		if ( (ave.start <= ave.bufferDb.start + ave.span)
			|| (ave.end >= ave.bufferDb.end - ave.span)
			|| (ave.chrom !== ave.bufferDb.chrom)) {
			ave.updateBufferDb();
		} 
				
	};
	
	ave.updateBufferDb = function() {
		var region = {};
		region.start = ( (ave.start - ave.bufferFlankSize) >= 0 ) ?
			(ave.start - ave.bufferFlankSize) : 0;
		region.end = ave.end + ave.bufferFlankSize;
		region.chrom = ave.chrom;
		socket.emit("getData", region);
	};
	
	ave.bufferDb = {};
	ave.updateBufferDb();
	
	ave.viewDb = {
		waiting: true
	};
	
	ave.updateViewDb = function() {
		ave.viewDb.waiting = false;
		ave.viewDb.loci = [];
		ave.viewDb.SNPs = [];
		ave.bufferDb.loci.forEach(function(locus) {
			if ( (locus.gene.end >= ave.start) && (locus.gene.start <= ave.end) ) {
				ave.viewDb.loci.push(locus);
			};
		});
		ave.bufferDb.SNPs.forEach(function(SNP) {
			if ( (SNP.end >= ave.start) && (SNP.start <= ave.end) ) {
				ave.viewDb.SNPs.push(SNP);
			}
		});
		ave.viewDb.haplotypes = ave.getHaplotypes(ave.viewDb.SNPs);
		draw();
	};
	
	ave.importToBufferDb = function(data) {
			ave.bufferDb.start = data.region.start;
			ave.bufferDb.end = data.region.end;
			ave.chrom = data.region.chrom;
			ave.bufferDb.SNPs = data.SNPs;
			ave.bufferDb.loci = data.loci;
			if (ave.viewDb.waiting) {
				ave.updateViewDb();
			};
	};

	ave.getHaplotypes = function(SNPs) {
		var strains = ave.getStrains(SNPs);
	};

	ave.getStrains = function(SNPs) {
		var refStrain = [];
		var strains = {};
		SNPs.forEach(function(SNP) {
			var pos = SNP.start;
			var refBase = SNP.attributes.Change.split(':')[0];
			refStrain[pos] = refBase;
			var strain = SNP.attributes.Strain;
			strains[strain] = [];
		});
		var strainsList = Object.keys(strains);
		strainsList.forEach(function(strain) {
			strains[strain] = refStrain;
		});
		SNPs.forEach(function(SNP) {
			var pos = SNP.start;
			var variant = SNP.attributes.Change.split(':')[1];
			var strain = SNP.attributes.Strain;
			strains[strain][pos] = variant;
		});
		return strains;
	};
	

	socket.on('data', function(data) {
		ave.importToBufferDb(data);
	});
	
	// reloading db on settings click
	$("#settings").click(function() {
		console.log("settings clicked");
		socket.emit('reloadDb');
	});
	$("#start").change(function() {	
		ave.start = parseInt($('#start').val(), 10);
		ave.updateDb();
	});
	$("#end").change(function() {	
		ave.end = parseInt($('#end').val(), 10);
		ave.updateDb();
	});
	$("#chrom").change(function() {	
		ave.chrom = $('#chrom').val().split("Chr")[1];
		ave.updateDb();
	});
	

});

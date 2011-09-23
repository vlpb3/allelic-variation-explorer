var ave = {};

$(document).ready(function(){
	
	var socket = io.connect('http://localhost');
	
	ave.bufferSize = 5;
	ave.start = parseInt($('#start').val(), 10);
	ave.end = parseInt($('#end').val(), 10);
	ave.chrom = parseInt($('#chrom').val().split('Chr')[1], 10);
	ave.span = ave.end - ave.start;
	ave.bufferFlankSize = ave.span * (ave.bufferSize-1)/2;
	ave.baseColors = {
		'A': 'red',
    'C': 'green',
    'G': 'blue',
    'T': 'orange'
	};
	
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
		ave.getHaplotypes();
		
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

	ave.getHaplotypes = function() {
		SNPs = ave.viewDb.SNPs;
		var refStrain = [];
		var strains = {};
		var haplotypes = {};
		var hapSnps = [];
		SNPs.forEach(function(SNP) {
			var pos = SNP.start;
			refStrain[pos] = ".";
			var strain = SNP.attributes.Strain;
			strains[strain] = {tag: [], SNPs: []};
		});
		var strainsList = Object.keys(strains);
		strainsList.forEach(function(strain) {
			strains[strain].tag = refStrain.slice();
		});
		SNPs.forEach(function(SNP) {
			var pos = SNP.start;
			var variant = SNP.attributes.Change.split(':')[1];
			var strain = SNP.attributes.Strain;
			strains[strain].tag[pos] = variant;
			strains[strain].SNPs.push(SNP);
		});
		var idx = 0;
		strainsList.forEach(function(strain) {
			tag = strains[strain].tag.join().replace(/,/g, "");
			strains[strain].tag = tag;
			if (haplotypes[tag]) {
				haplotypes[tag].strains.push(strain);
			}
			else {
				haplotypes[tag] = {strains: [strain]};
				var SNPs = strains[strain].SNPs;
				SNPs.forEach(function(SNP) {
					// array [tag, idx, position, base]
					hapSnps.push({
						tag: tag,
						idx: idx,
						pos: SNP.start,
						base: SNP.attributes.Change.split(':')[1]
					});
				});
				idx++;
			}
		});
		ave.viewDb.nHaps = idx;
		ave.viewDb.hapSnps = hapSnps;
		ave.viewDb.haplotypes = haplotypes;
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

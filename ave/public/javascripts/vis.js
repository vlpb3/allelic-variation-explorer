var draw;
var svg;
$(document).ready(function() {
	
	var dim = {
		trackH: 20,
		glyphH: 12,
		glyphT: 4,
		w: 720,
		h: 740,
		l: 40,
		r: 40,
		t: 20,
		b: 40
	};
	
	svg = d3.select('#chart').append('svg:svg')
						.attr('width', dim.l + dim.w + dim.r)
						.attr('height', dim.t + dim.h + dim.b)
						.attr('pointer-events', 'all')
					.append('svg:g')
						.attr('transform', 'translate(' + dim.l + ', ' + dim.t + ')');

	
	draw = function() {
		var x = d3.scale.linear().domain([ave.start, ave.end])
                        .range([0, dim.w]);
		var CDSs = [];
		var threePrimeUTRs = [];
		var fivePrimeUTRs = [];
		var nLoci = ave.viewDb.loci.length;
		var nModelTracks= 0;
		
		
		for (var iLocus=0; iLocus<nLoci; iLocus++) {
			var nModels = ave.viewDb.loci[iLocus].geneModels.length;
			// get number of tracks with gene models (needed for start of SNP tracks)
			nModelTracks = (nModels > nModelTracks) ? nModels : nModelTracks;
			
			for(var iModel=0; iModel<nModels; iModel++) {
				// extract Coding Sequences
				var nCDSs = ave.viewDb.loci[iLocus].geneModels[iModel].CDSs.length;
				for (var iCDS=0; iCDS<nCDSs; iCDS++) {
					var cds = {
						x0: x(ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS].start),
						x1: x(ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS].end),
						y: iModel * dim.trackH + dim.glyphT,
						ref: ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS]
					};
					CDSs.push(cds);
				}
				// extract UTRs
				var n5UTRs = ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs.length;
				var n3UTRs = ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs.length;	
				// 5'UTRs
				for (var iUTR=0; iUTR<n5UTRs; iUTR++) {
					var utr = {
						x0:  x(ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR].start),
						x1:  x(ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR].end),
						y: iModel * dim.trackH + dim.glyphT,
						ref: ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR]
					};
					fivePrimeUTRs.push(utr);
				};
				for (var iUTR=0; iUTR<n3UTRs; iUTR++) {
					var utr = {
						x0: x(ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs[iUTR].start),
						x1: x(ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs[iUTR].end),
						y: iModel * dim.trackH + dim.glyphT
					};		
					threePrimeUTRs.push(utr);
				};
			};
		};
		console.log(fivePrimeUTRs);
		console.log(threePrimeUTRs);
		
		//----DISPLAY--------------
		// rules 
		
		var rules = svg.selectAll('g.rule')
				.data(x.ticks(10), String);
		
		rules.attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});
		var newRules = rules.enter().append('svg:g')
				.attr('class', 'rule')
				.attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});
		
		newRules.append('svg:line')
				.attr('y1', 0)
				.attr('y2', dim.h)
				.attr('stroke', 'black')
				.attr('stroke-opacity', 0.2);
		
		newRules.append("svg:text")
				.attr('y', -10)
				.attr('dy', '.71em')
				.attr('text-anchor', 'middle')
				.text(x.tickFormat(10));
		
		rules.exit().remove();
				
		// draw Coding Sequences
		var cdsRect = svg.selectAll('.cds').data(CDSs);
		cdsRect.attr('x', function(d) { return d.x0; });
		cdsRect.enter().append('svg:rect')
					.attr('class', 'cds')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.x1 - d.x0; })
					.attr('x', function(d) { return d.x0; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'steelblue');
		cdsRect.exit().remove();
						
						
		// draw UTRs
		var threePrimeRect = svg.selectAll('.threePrime').data(threePrimeUTRs);	
		threePrimeRect.attr('x', function(d) { return d.x0; });
		threePrimeRect.enter().append('svg:rect')
					.attr('class', 'threePrime')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.x1 - d.x0; })
					.attr('x', function(d) { return d.x0; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'teal');
		threePrimeRect.exit().remove();
		

		var fivePrimeRect = svg.selectAll('.fivePrime').data(fivePrimeUTRs);
		fivePrimeRect.attr('x', function(d) { return d.x0; });
		fivePrimeRect.enter().append('svg:rect')
					.attr('class', 'fivePrime')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.x1 - d.x0; })
					.attr('x', function(d) { return d.x0; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'slateblue');
		fivePrimeRect.exit().remove();
	};
});




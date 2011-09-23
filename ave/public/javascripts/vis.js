var draw;
var svg;
var x;			

$(document).ready(function() {
	
	var dim = {
		trackH: 20,
		glyphH: 12,
		glyphT: 4,
		w: 720,
		h: 1000,
		l: 40,
		r: 40,
		t: 20,
		b: 40
	};
	
	svg = d3.select("#chart").append("svg:svg")
						.attr("width", dim.l + dim.w + dim.r)
						.attr("height", dim.t + dim.h + dim.b)
						.attr("pointer-events", "all")
						// .call(d3.behavior.zoom().on("zoom", redraw))
					.append("svg:g")
						.attr("transform", "translate(" + dim.l +  ", " + dim.t + ")");
	
	function redraw(){
		if (d3.event) d3.event.transform(x);
		
		var start = d3.round(x.invert(0));
	  var end = d3.round(x.invert(dim.w));
		ave.start = start;
		ave.end = end;
		$('#start').val(start);
		$('#end').val(end);
		ave.updateDb();
	}
	
	
	draw = function() {
		x = d3.scale.linear().domain([ave.start, ave.end])
		                        .range([0, dim.w]);
		
		var genes = [];
		var CDSs = [];
		var threePrimeUTRs = [];
		var fivePrimeUTRs = [];
		var nLoci = ave.viewDb.loci.length;
		var nModelTracks= 0;
		
		
		for (var iLocus=0; iLocus<nLoci; iLocus++) {
			var nModels = ave.viewDb.loci[iLocus].geneModels.length;
			// get number of tracks with gene models (needed for start of SNP tracks)
			nModelTracks = (nModels > nModelTracks) ? nModels : nModelTracks;
			// add gene to the list
			var start = ave.viewDb.loci[iLocus].gene.start;
			var end = ave.viewDb.loci[iLocus].gene.end;
			if ((end > ave.start) && (start < ave.end)) {
				start = (start < ave.start) ? ave.start : start;
				end = (end > ave.end) ? ave.end : end;
				var gene = {
					x: x(start),
					w: x(end) - x(start),
					y: dim.glyphT,
					name: ave.viewDb.loci[iLocus].gene.attributes.Name,
					ref: ave.viewDb.loci[iLocus].gene
				};
				genes.push(gene);
			}
			for(var iModel=0; iModel<nModels; iModel++) {
			
				// extract Coding Sequences
				var nCDSs = ave.viewDb.loci[iLocus].geneModels[iModel].CDSs.length;
				for (var iCDS=0; iCDS<nCDSs; iCDS++) {
					var start = ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS].start;
					var end = ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS].end;
					if ((end > ave.start) && (start < ave.end)) {
						start = (start < ave.start) ? ave.start : start;
						end = (end > ave.end) ? ave.end : end;
						var cds = {
							x: x(start),
							w: x(end) - x(start),
							y: (iModel + 1) * dim.trackH + dim.glyphT,
							ref: ave.viewDb.loci[iLocus].geneModels[iModel].CDSs[iCDS]
						};
						CDSs.push(cds);
					}
				}
				// extract UTRs
				var n5UTRs = ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs.length;
				var n3UTRs = ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs.length;	
				// 5'UTRs
				for (var iUTR=0; iUTR<n5UTRs; iUTR++) {
					var start = ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR].start;
					var end = ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR].end;
					if ((end > ave.start) && (start < ave.end)) {
						start = (start < ave.start) ? ave.start : start;
						end = (end > ave.end) ? ave.end : end;
						var utr = {
							x:  x(start),
							w:  x(end) - x(start),
							y: (iModel + 1) * dim.trackH + dim.glyphT,
							ref: ave.viewDb.loci[iLocus].geneModels[iModel].fivePrimeUTRs[iUTR]
						};
						fivePrimeUTRs.push(utr);
					}
				};
				for (var iUTR=0; iUTR<n3UTRs; iUTR++) {
					var start = ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs[iUTR].start;
					var end = ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs[iUTR].end;
					if ((end > ave.start) && (start < ave.end)) {
						start = (start < ave.start) ? ave.start : start;		
						end = (end > ave.end) ? ave.end : end;
						var utr = {
							x: x(start),
							w: x(end) - x(start),
							y: (iModel + 1) * dim.trackH + dim.glyphT,
							ref: ave.viewDb.loci[iLocus].geneModels[iModel].threePrimeUTRs[iUTR]
						};		
						threePrimeUTRs.push(utr);

					}
				};
			};
		};
		// update hieght according to amount of features
		dim.h = (nModelTracks + 1 + ave.viewDb.nHaps)*dim.trackH;

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
		
		// draw genes
		var geneRect = svg.selectAll('.gene').data(genes);
		geneRect.attr('x', function(d) { return d.x; })
					.attr('width', function(d) { return d.w; });
		geneRect.enter().append('svg:rect')
					.attr('class', 'gene')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.w; })
					.attr('x', function(d) { return d.x; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'chartreuse');
		geneRect.exit().remove();
		
		// wrrite gene labels
		var geneLabel = svg.selectAll(".geneLabel").data(genes);
		geneLabel.attr("x", function(d) {return d.x;});
		geneLabel.enter().append("svg:text")
							.attr("class", "geneLabel")
							.attr("x", function(d) {return d.x;})
							.attr("y", function(d) {return d.y;})
							.attr("dy", "1em")
							.attr("dx", "0.5em")
							.text(function(d) {return d.name;});
		geneLabel.exit().remove();
				
		// draw Coding Sequences
		var cdsRect = svg.selectAll('.cds').data(CDSs);
		cdsRect.attr('x', function(d) { return d.x; })
					.attr('width', function(d) { return d.w; });
		cdsRect.enter().append('svg:rect')
					.attr('class', 'cds')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.w; })
					.attr('x', function(d) { return d.x; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'steelblue');
		cdsRect.exit().remove();
						
						
		// draw UTRs
		var threePrimeRect = svg.selectAll('.threePrime').data(threePrimeUTRs);	
		threePrimeRect.attr('x', function(d) { return d.x; })
									.attr('y', function(d) { return d.y; })
									.attr('width', function(d) { return d.w; });
		threePrimeRect.enter().append('svg:rect')
					.attr('class', 'threePrime')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.w; })
					.attr('x', function(d) { return d.x; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'teal');
		threePrimeRect.exit().remove();
		

		var fivePrimeRect = svg.selectAll('.fivePrime').data(fivePrimeUTRs);
		fivePrimeRect.attr('x', function(d) { return d.x; })
								.attr('y', function(d) { return d.y; })
								.attr('width', function(d) { return d.w; });
		fivePrimeRect.enter().append('svg:rect')
					.attr('class', 'fivePrime')
					.attr('height', dim.glyphH)
					.attr('width', function(d) { return d.w; })
					.attr('x', function(d) { return d.x; })
					.attr('y', function(d) { return d.y; })
					.attr('fill', 'slateblue');
		fivePrimeRect.exit().remove();
		
		// draw haplotype bars
		var haps = [];
		for (var i = 0; i<ave.viewDb.nHaps; i++) {
			haps.push( (nModelTracks + i + 1) *dim.trackH + dim.glyphT);
		}
		var hapBars = svg.selectAll('.hap').data(haps, String);
		hapBars.attr('y', function(d) {return d;});
		hapBars.enter().append('svg:rect')
					.attr('class', 'hap')
					.attr('height', dim.glyphH)
					.attr('width', dim.w)
					.attr('x', x(ave.start))
					.attr('y', function(d) {return d;})
					.attr('fill', 'lavender');
		hapBars.exit().remove();
					
		// draw SNPs
		var snpCircles = svg.selectAll('.snp').data(ave.viewDb.hapSnps);
		snpCircles.attr('cx', function(d) {return x(d.pos);})
							.attr('cy', function(d) {
								return (d.idx + nModelTracks + 1)*dim.trackH + dim.trackH/2;
								})
							.attr('fill', function(d) {return ave.baseColors[d.base];});
		snpCircles.enter().append('svg:circle')
					.attr('class', 'snp')
					.attr('r', dim.glyphH/4)
					.attr('cx', function(d) {return x(d.pos);})
					.attr('cy', function(d) {
						return (d.idx + nModelTracks + 1)*dim.trackH + dim.trackH/2;
						})
					.attr('fill', function(d) {return ave.baseColors[d.base];});
		snpCircles.exit().remove();
	};
});




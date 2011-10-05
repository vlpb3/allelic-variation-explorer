(function ($) {
  
  // router stuff 
  var AppRouter = Backbone.Router.extend({
    
    initialize: function(options) {
      _.bindAll(this, "moveModel", "navigateTo");
      this.model = options.model;
      
      // this.navigateTo();
      // when model changes, navigate to new place      
      this.model.bind("change:pos", this.navigateTo);
    },
    
    routes: {
      "goto/chrom:ch/start:s/end:e": "moveModel"
    },
    
    moveModel: function(ch, s, e) {
      var pos = {
        "chrom": parseInt(ch, 10),
        "starts": parseInt(s, 10),
        "ends": parseInt(e, 10)
      };
      this.model.set({"pos": pos});
    },
    
    navigateTo: function(){
      var pos = this.model.get("pos");
      var path = "goto/chrom" + pos.chrom + "/start" + pos.starts + "/end" + pos.ends;  
      this.navigate(path);
    }
  });
  
  // Views
  // view for choosing the region to display
  var choiceView = Backbone.View.extend({
    
    initialize: function() {

      _.bindAll(this, "render", "updateModel");
      
      this.render();
      // get values form the model
      $("#radioRegion").click();
      var pos = this.model.get("pos");
      $("#chrom").val(pos.chrom);
      $("#start").val(pos.starts);
      $("#end").val(pos.ends);
      
      // listen to changes of the model
      this.model.bind('change:pos', function(model, pos){
        $("#chrom").val(pos.chrom);
        $("#start").val(pos.starts);
        $("#end").val(pos.ends);
      });         
    },
    
    events: {
      "change #chrom": 'updateModel',
      "change #start": 'updateModel',
      "change #end": 'updateModel'
    },
    
    updateModel: function() {
      var update = {
        "pos": {
          "chrom": parseInt($("#chrom").val(), 10),
          "starts": parseInt($("#start").val(), 10),
          "ends": parseInt($("#end").val(), 10)
        }
      };
      this.model.set(update);
    },
    
    render: function() {

      // get radio buttons displayed properly
      $("#radio").buttonset();
      
      // hide both searchbox sets at the beginning
      $("#regionSearch").hide();
      $("#featureSearch").hide();
      
      // bind actions to these button sets
      $("#radioRegion").click(function(){
        $("#regionSearch").show();
        $("#featureSearch").hide();
      });
        
      $("#radioFeature").click(function(){
        $("#featureSearch").show();
        $("#regionSearch").hide();
      });
      
      return this;
    }
    
  });
  
  // model for all the data
  var DataModel = Backbone.Model.extend({
    
    defaults: {
      "socket": io.connect("http://localhost"),
      "bufferX": 5,
      "pos": {
        "chrom": 1,
        "starts": 3500,
        "ends": 9000
      },
      "bufferData": {
          starts: 0,
          ends: 0,
          chrom: 0,
          SNPs: {},
          loci: {}
          },
      "displayData": {
        waiting: true,
        loci: [],
        SNPs: [],
        features: [],
        haplotypes: []
        }
    },
    
    initialize: function() {
      _.bindAll(this, "updatePosition", "updateDisplayData",
        "waitForData", "updateBufferData", "importData",
        "isLocusInRegion", "isFeatureInRegion", "calcHaplotypes");

      this.updateBufferData();
      
      // update the model when position chnages
      this.bind("change:pos", function() {
        this.updatePosition();
      });
      // when data come back
      this.get("socket").on("data", this.importData);
    },
    
    importData: function(data) {
      var bufferData = this.get("bufferData");
      
      bufferData.chrom = data.region.chrom;
      bufferData.starts = data.region.start;
      bufferData.ends = data.region.end;
      bufferData.SNPs = data.SNPs;
      bufferData.loci = data.loci;
      bufferData.features = data.features;
      
      this.set({"bufferData": bufferData});
      if (this.get("displayData").waiting) {
         this.updateDisplayData();
      }
    },
    
    waitForData: function(ifwait) {
      var displayData = this.get("displayData");
      displayData.waiting = ifwait;
      this.set(displayData);
    },
    
    updatePosition: function(){
      var pos = this.get("pos");
      var span = pos.ends - pos.starts;
      var bufferData = this.get("bufferData");
      
      // check if there is a need for fetching new buffer
      var startToClose = (bufferData.starts > 0) &&
        (bufferData.starts > (pos.starts - span));
      var endToClose = bufferData.ends - pos.ends - span;
      var otherChromosome = pos.chrom !== bufferData.chrom;
      // if there is fetch
      if (startToClose || endToClose || otherChromosome) {
        this.updateBufferData();
      }
      
      // check if new position is in buffer
      var startInBuffer = pos.starts >= bufferData.starts;
      var endInBuffer = pos.ends <= bufferData.ends;
      // if it is import otherwise say waiting
      if (startInBuffer && endInBuffer && !otherChromosome) {
        this.updateDisplayData();
      }
      else this.waitForData(true);
    },
    
    updateBufferData: function() {
      var pos = this.get("pos");
      var span = pos.ends - pos.starts;
      var flank = (this.get("bufferX") - 1) * span/2;
      var start = pos.starts - flank;
      newBufferStart = start >= 0 ? start : 0;
      newBufferEnd = pos.ends + flank;
      var region = {chrom: pos.chrom, start: newBufferStart, end: newBufferEnd};   
      this.get("socket").emit("getData", region);
    },
    
    updateDisplayData: function() {

      // first fetch the fragment from the buffer
      var displayData = this.get("displayData");

      // get SNPs
      var SNPs = this.get("bufferData").SNPs;
      var pos = this.get("pos");
      displayData.SNPs = _.select(SNPs, function(snp) {
        return ((snp.start >= pos.starts) && (snp.start <= pos.ends));
      });
      
      // get loci
      var loci = this.get("bufferData").loci;
      displayData.loci = _.select(loci, this.isLocusInRegion);
      
      // get features
      var features = this.get("bufferData").features;
      displayData.features = _.select(features, this.isFeatureInRegion);
 
      // set obtained data to the model
      this.set({"displayData": displayData});
      
      // calculate haplotypes from SNPs in the region
      this.calcHaplotypes();
    },
    
    isLocusInRegion: function(locus) {
      var pos = this.get("pos");
      if(locus.gene.start <= pos.ends && locus.gene.end >= pos.starts) {
        return true;
      } else return false;
    },
    
    isFeatureInRegion: function(feature) {
      var pos = this.get("pos");
      if(feature.start <= pos.ends && feature.end >= pos.starts) {
        return true;
      } else return false;
    },
    
    calcHaplotypes: function() {

      var displayData = this.get("displayData");
      var SNPs = displayData.SNPs;
      
      // create strains object
      var strains = _.reduce(SNPs, function(memo, snp) {
        var strain = snp.attributes.Strain;
        var idx = snp.start;
        var variant = snp.attributes.Change.split(":")[1];
        var variantArr = (memo[strain] || []);
        variantArr[idx] = variant;
        memo[strain] = variantArr;
        return memo;
      }, {});

      // group strains by snps
      var haplotypes = {};
      _.each(strains, function(strainSNPs, strainName, strains) {
        var haplID = _.zip(_.keys(strainSNPs), _.compact(strainSNPs)).join();
        var haplotype = (haplotypes[haplID] || []);
        haplotype.push({name: strainName, snps: strainSNPs});
        haplotypes[haplID] = haplotype;
      });
      
      displayData.haplotypes = haplotypes;
      this.set({"displayData": displayData});
      this.trigger('change:displayData');
    }
    
  });

  var VisView = Backbone.View.extend({
    
    initialize: function() {
      _.bindAll(this, "render", "draw");
      
      this.trackH = 20;
      this.glyphH = 12;
      this.glyphT = 4;
      this.width = 720;
      this.height = 10000;
      this.left = 40;
      this.right = 40;
      this.top = 20;
      this.bottom = 4;
    
      this.model.bind('change:displayData', this.draw, this);
      
      this.render();
    },
    
    render: function() {
      
      this.svg = d3.select("#chart").append("svg:svg")
          .attr("width", this.left + this.width + this.right)
          .attr("height", this.top + this.height + this.bottom)
        .append("svg:g")
          .attr("transform", "translate(" + this.left + "," + this.top + ")");
      this.draw();
      return this;
    },
    
    draw: function() {
      var pos = this.model.get("pos");
      var width = this.width;

      var x = d3.scale.linear().domain([pos.starts, pos.ends]).range([0, this.width]);
      
      var displayData = this.model.get("displayData");
      var features = displayData.features;
      var haplotypes = displayData.haplotypes;
      
      var glyphH = this.glyphH;
      var glyphT = this.glyphT;
      var trackH = this.trackH;
      var freePos = glyphT; 
      
      // draw genes
      var genes = _.select(features, function(feature) {
        return feature.type === "gene";
      });
      
      var geneRect = this.svg.selectAll('.gene').data(genes);
      geneRect.attr("x", function(d) { return x(d.start); })
              .attr("width", function(d) { return x(d.end) - x(d.start); });
      geneRect.enter().append("svg:rect")
              .attr("class", "gene")
              .attr("height", glyphH)
              .attr("x", function(d) { return x(d.start); })
              .attr("y", function(d) { return freePos; })
              .attr("width", function(d) { return x(d.end) - x(d.start); })
              .attr("fill", "chartreuse");
      geneRect.exit().remove();

      // draw gene labels
      var geneLabel = this.svg.selectAll(".geneLabel").data(genes);
      geneLabel.attr("x", function(d) { return x(d.start); });
      geneLabel.enter().append("svg:text")
                .attr("class", "geneLabel")
                .attr("x", function(d) { return x(d.start); })
                .attr("y", function(d) { return freePos; })
                .attr("dy", "1.075em")
                .attr("dx", "0.5em")
                .text(function(d) { return d.attributes.Name; });
      geneLabel.exit().remove();
            
      freePos += trackH;
      
      // draw gene models
      var UTR5s = _.select(features, function(feature) {
        return feature.type === "five_prime_UTR";
      });
      var UTR3s = _.select(features, function(feature) {
        return feature.type === "three_prime_UTR";
      });
      var CDSs = _.select(features, function(feature) {
        return feature.type === "CDS";
      });

      var yPos = function(d) {
        var nModel = d.attributes.Parent.split(",")[0].split(".")[1] || 1; 
        return freePos + (nModel - 1)*trackH;
      };
      
      var UTR5Rect = this.svg.selectAll('.UTR5').data(UTR5s);
      UTR5Rect.attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); });
      UTR5Rect.enter().append("svg:rect")
              .attr("class", "UTR5")
              .attr("height", glyphH)
              .attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); })
              .attr("fill", "slateblue");
      UTR5Rect.exit().remove();
      
      var UTR3Rect = this.svg.selectAll('.UTR3').data(UTR3s);
      UTR3Rect.attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); });
      UTR3Rect.enter().append("svg:rect")
              .attr("class", "UTR3")
              .attr("height", glyphH)
              .attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); })
              .attr("fill", "teal");
      UTR3Rect.exit().remove();
      
      var CDSRect = this.svg.selectAll('.CDS').data(CDSs);
      CDSRect.attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); });
      CDSRect.enter().append("svg:rect")
              .attr("class", "CDS")
              .attr("height", glyphH)
              .attr("x", function(d) { return x(d.start); })
              .attr("y", yPos)
              .attr("width", function(d) { return x(d.end) - x(d.start); })
              .attr("fill", "steelblue");
      CDSRect.exit().remove();
      
      // calculate new freePos by calculating the max number of gene models per locus
      var allFeatures = UTR5s.concat(CDSs).concat(UTR3s);
      var maxModels = _.reduce(allFeatures, function(memo, f) {
        var nModel = f.attributes.Parent.split(",")[0].split(".")[1];
        nModel = parseInt(nModel, 10); 
        memo = memo < nModel ? nModel : memo;
        return memo;
      }, 0);

      console.log(UTR3s);
      freePos += trackH*maxModels;
      

      
      // get SNPs with haplotype indexes
      this.hapSNPs = [];
      this.hapCounter = 0;
      _.map(haplotypes, function(haplotype, idx, haplotypes) {
        var snps = haplotype[0].snps;
        _.map(snps, function(snp, idx, snps) {
          var hapSNP = {
            haplotype: this.hapCounter,
            x: idx,
            base: snp
          };
          this.hapSNPs.push(hapSNP);
        }, this);
        this.hapCounter += 1;
      }, this);

      // draw haplotypes
      var haplotypeBars = this.svg.selectAll('.hap').data(_.range(_.size(haplotypes)));
      haplotypeBars.attr('y', function(d, i) { return freePos + i*trackH; });
      haplotypeBars.enter().append('svg:rect')
              .attr('class', 'hap')
              .attr('height', glyphH)
              .attr('width', width)
              .attr('x', x(pos.starts))
              .attr('y', function(d, i) { return freePos + i*trackH; })
              .attr('fill', 'lavender');
      haplotypeBars.exit().remove();

      // draw SNPs
      var SNPCircles = this.svg.selectAll('.SNP').data(this.hapSNPs);
      SNPCircles.attr('cx', function(d) { return x(d.x); })
                .attr('cy', function(d) {

                  return (d.haplotype + maxModels + 1.5)*trackH;
                  })
                .attr('fill', this.baseColor);
      SNPCircles.enter().append('svg:circle')
                .attr('class', 'SNP')
                .attr('r', glyphH/4)
                .attr('cx', function(d) { return x(d.x); })
                .attr('cy', function(d) {
                  return (d.haplotype + maxModels + 1.5)*trackH;
                  })
                .attr('fill', this.baseColor);
      SNPCircles.exit().remove(); 

      // draw rules
      this.height = (1 + maxModels + _.size(haplotypes))*trackH;
      var rules = this.svg.selectAll('g.rule')
          .data(x.ticks(10), String);
      this.svg.selectAll('.ruleLine')
          .attr("y2", this.height);

      rules.attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});
      var newRules = rules.enter().append('svg:g')
          .attr('class', 'rule')
          .attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});

      newRules.append('svg:line')
          .attr("class", "ruleLine")
          .attr('y1', 0)
          .attr('y2', this.height)
          .attr('stroke', 'black')
          .attr('stroke-opacity', 0.1);

      newRules.append("svg:text")
          .attr('y', -10)
          .attr('dy', '.71em')
          .attr('text-anchor', 'middle')
          .text(x.tickFormat(10));

      rules.exit().remove();
      
    },
    
    baseColor: function(d) {
      var baseColors = {
        'A': 'red',
        'C': 'green',
        'G': 'blue',
        'T': 'orange'
      };
      return baseColors[d.base];
    }
    
  });
  
  
  $(document).ready(function(){

    // initialize models
    var dataModel = new DataModel();

    // initialize views
    var goRegionView = new choiceView({
      el: $("#locationChoice"),
      model: dataModel
    });
    
    // initialize router
    var appRouter = new AppRouter({model: dataModel});
    Backbone.history.start();
    
    var visView = new VisView({
      el: $("#chart"),
      model: dataModel
    });
    
  });
  
}
)(jQuery);
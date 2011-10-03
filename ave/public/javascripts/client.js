(function ($) {
  
  // router stuff 
  var AppRouter = Backbone.Router.extend({
    
    initialize: function(options) {
      _.bindAll(this, "moveModel", "navigateTo");
      this.model = options.model;
      
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
        "starts": 0,
        "ends": 10000
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
        SNPs: []
        }
    },
    
    initialize: function() {
      _.bindAll(this, "updatePosition", "updateDisplayData",
        "waitForData", "updateBufferData", "importData",
        "isLocusInRegion", "calcHaplotypes");

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
    }
    
  });

  var VisView = Backbone.View.extend({
    
    initialize: function() {
      _.bindAll(this, "render", "draw");
      
      this.trackH = 20;
      this.glyphH = 12;
      this.width = 720;
      this.height = 10000;
      this.left = 40;
      this.right = 40;
      this.top = 20;
      this.bottom = 4;
    
      this.model.bind('change', function(model, change){
        this.draw();
      });
      
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
      var starts = this.model.get("starts");
      var ends = this.model.get("ends");
      this.startFrom = 0;
      
      this.x = scale.linear().domain([starts, ends]).range([0, this.width]);
      
    },
    
    drawLoci: function() {
      
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
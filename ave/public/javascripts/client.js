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
      "displayData": {waiting: true}
    },
    
    initialize: function() {
      _.bindAll(this, "updatePosition", "updateDisplayData",
        "waitForData", "updateBufferData", "importData");

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
    
  });
  
}
)(jQuery);
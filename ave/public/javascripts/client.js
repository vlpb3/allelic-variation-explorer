(function ($) {
  
  // router stuff 
  var AppRouter = Backbone.Router.extend({
    
    routes: {
      "goto/chrom:ch/start:s/end:e": "go"
    },
    
    go: function(ch, s, e) {
      console.log("Going to: " + ch + " from: " + s + " to: " + e );
    }
  });
  
  var choiceView = Backbone.View.extend({
    
    initialize: function() {

      _.bindAll(this, "render");
      
      this.render();
    },
    
    render: function() {

      // get radio buttons displayed properly
      $("#radio").buttonset();
      
      // hide both searchbox sets at the beginning
      $("#regionSearch").hide();
      $("#featureSearch").hide();
      
      // bind actions to these button sets
      console.log($("#radioRegion"));
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
  
  $(document).ready(function(){
    // initialize router
    var appRouter = new AppRouter();
    Backbone.history.start();
  
    // initialize views
    var goRegionView = new choiceView({el: $("#locationChoice")});
    
  });
  
}
)(jQuery);
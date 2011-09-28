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
  
  var GoRegionView = Backbone.View.extend({
    
    initialize: function() {

      _.bindAll(this, 'render');
      
      this.render();
    },
    
    render: function() {
      console.log($(this.el));
      $(this.el).append("<p>lakfjlak fjalk f</p>");
      return this;
    }

  });
  
  $(document).ready(function(){
    // initialize router
    var appRouter = new AppRouter();
    Backbone.history.start();
  
    // initialize views
    var goRegionView = new GoRegionView({el: $("#regionGo")});
  });
  
}
)(jQuery);
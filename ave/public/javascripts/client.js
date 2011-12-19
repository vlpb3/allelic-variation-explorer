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
      "goto/:ch/start:s/end:e": "moveModel"
    },

    moveModel: function(ch, s, e) {
      var pos = {
        "chrom": ch,
        "starts": parseInt(s, 10),
        "ends": parseInt(e, 10)
      };
      this.model.set({"pos": pos});
    },

    navigateTo: function(){
      var pos = this.model.get("pos");
      var path = "goto/" + pos.chrom + "/start" +
        pos.starts + "/end" + pos.ends;
      this.navigate(path);
    }
  });

  // Views
  // view for choosing the region to display
  var choiceView = Backbone.View.extend({

    initialize: function() {

      _.bindAll(this, "render", "updateModel", "goToFeature",
        "onFeatureNotFound");

      this.render();
      // get values form the model
      $("#radioRegion").click();
      var pos = this.model.get("pos");
      $("#chrom").val(pos.chrom);
      $("#start").val(pos.starts);
      $("#end").val(pos.ends);

      this.model.get("socket")
        .on("featureNotFound", this.onFeatureNotFound);
    },

    events: {
      "click #go" : "updateModel",
      "click #search": "goToFeature"
    },

    updateModel: function() {
      var update = {
        "pos": {
          "chrom": $("#chrom").val(),
          "starts": parseInt($("#start").val(), 10),
          "ends": parseInt($("#end").val(), 10)
        }
      };
      this.model.set(update);
    },

    onFeatureNotFound: function(info){
      $("#searchMessage").text("\t " + info);
    },

    goToFeature: function() {
      $("#searchMessage").text("");
      var name = $("#name").val();
      var flank = parseInt($("#flank").val(), 10);
      this.model.goToFeature(name, flank);
    },

    render: function() {

      // get buttons displayed properly
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

  var NavigateView = Backbone.View.extend({

    initialize: function() {
      _.bindAll(this, "render", "updateString",
        "goLeft", "zoomOut", "zoomIn", "goRight");
      this.step = 5;
      this.render();
      this.updateString();
      this.model.bind("change:pos", this.updateString);
    },

    render: function() {
      var winWidth = $(window).width();
      $("#navigate").css("left", winWidth/2 - 95);
      $("#navigate").css("width", winWidth/2);
    },

    events: {
      "click #goLeft": "goLeft",
      "click #zoomOut": "zoomOut",
      "click #zoomIn": "zoomIn",
      "click #goRight": "goRight"
    },

    goLeft: function() {
      var pos = this.model.get("pos");
      var step = Math.floor((pos.ends - pos.starts) / this.step);
      var starts = pos.starts - step;
      starts = starts > 0 ? starts : 0;
      var ends = pos.ends - step;
      var update = {
        pos: {
          "starts": starts,
          "ends": ends,
          "chrom": pos.chrom
        }
      };
      this.model.set(update);
    },

    zoomOut: function() {
      var pos = this.model.get("pos");
      var step = Math.floor((pos.ends - pos.starts) / 2);
      var starts = pos.starts - step;
      starts = starts > 0 ? starts : 0;
      var ends = pos.ends + step;
      var update = {
        pos: {
          "starts": starts,
          "ends": ends,
          "chrom": pos.chrom
        }
      };
      this.model.set(update);
    },

    zoomIn: function() {
      var pos = this.model.get("pos");
      var step = Math.floor((pos.ends - pos.starts) / 4);
      var starts = pos.starts + step;
      var ends = pos.ends - step;
      var update = {
        pos: {
          "starts": starts,
          "ends": ends,
          "chrom": pos.chrom
        }
      };
      this.model.set(update);

    },

    goRight: function() {
      var pos = this.model.get("pos");
      var step = Math.floor((pos.ends - pos.starts) / this.step);
      var starts = pos.starts + step;
      var ends = pos.ends + step;
      var update = {
        pos: {
          "starts": starts,
          "ends": ends,
          "chrom": pos.chrom
        }
      };
      this.model.set(update);
    },

    updateString: function() {
      var pos = this.model.get("pos");
      var positionStr = pos.chrom + ":" +
        pos.starts + ".." + pos.ends;
      var strech = pos.ends - pos.starts;
      positionStr += " fragment: " + strech + "bp";
      $("#positionText").html(positionStr);
    }
  });

  var ControlsView = Backbone.View.extend({

    initialize: function() {
      _.bindAll(this, "render", "openFilterDialog",
        "renderStrainList", "renderSNPList", "updateLists",
        "applyFilters", "removeSelected", "addSelected");

      this.render();
    },

    render: function() {
      $("#filterDialog").hide();
      $("#filterButton").button();

      // filter dialog stuff
      this.filterDialog = $("#filterDialog").dialog({
        autoOpen: false,
        title: "Exclude/Include SNPs/strains",
        width: 450
      });

      $("#filterRadio").buttonset();
      $("#applyFilters button").button()
        .click(this.applyFilters);

      // hide the lists
      $("#exclStrains").hide();
      $("#inclStrains").hide();
      $("#exclSNPs").hide();
      $("#inclSNPs").hide();

      // connect list rendering to toggle buttons
      $("#radioStrains").click(this.renderStrainList);
      $("#radioSNPs").click(this.renderSNPList);

      $("#addButton").button()
        .click(this.addSelected);
      $("#removeButton").button()
        .click(this.removeSelected);

      $("#included ul").selectable({
        stop: function() {
          $("#addButton").removeClass("ui-state-active");
          $("#removeButton").addClass("ui-state-active");
        }
      });
      $("#excluded ul").selectable({
        stop: function() {
          $("#removeButton").removeClass("ui-state-active");
          $("#addButton").addClass("ui-state-active");
        }
      });
    },

    events: {
      "click #filterButton": "openFilterDialog"
    },

    openFilterDialog: function() {
      $("#filterDialog").dialog('open');

      // fill lists in
      this.updateLists();
      this.renderStrainList();
    },

    updateLists: function() {
      var filters = this.model.get("displayData").filters;
      var SNPsIncl = filters.SNPs.incl;
      var SNPsExcl = filters.SNPs.excl;
      var strainsIncl = filters.strains.incl;
      var strainsExcl = filters.strains.excl;

      // append lists
      var inclSNPsAnchor = $("#inclSNPs ul");
      inclSNPsAnchor.empty();
      _.each(SNPsIncl, function(snpID, i) {
        inclSNPsAnchor.append("<li>" + snpID + "</li>");
      });
      var inclStrainsAnchor = $("#inclStrains ul");
      inclStrainsAnchor.empty();
      _.each(strainsIncl, function(strain, i) {
        inclStrainsAnchor.append("<li>" + strain + "</li>");
      });
      var exclSNPsAnchor = $("#exclSNPs ul");
      exclSNPsAnchor.empty();
      _.each(SNPsExcl, function(snpID, i) {
        exclSNPsAnchor.append("<li>" + snpID + "</li>");
      });
      var exclStrainsAnchor = $("#exclStrains ul");
      exclStrainsAnchor.empty();
      _.each(strainsExcl, function(strain, i) {
        exclStrainsAnchor.append("<li>" + strain + "</li>");
      });
    },

    // strains list rendering
    renderStrainList: function() {
      $("#exclStrains").show();
      $("#inclStrains").show();
      $("#exclSNPs").hide();
      $("#inclSNPs").hide();
    },

    // SNPs list rendering
    renderSNPList: function() {
      // hide strain lists and show snp lists
      $("#exclStrains").hide();
      $("#inclStrains").hide();
      $("#exclSNPs").show();
      $("#inclSNPs").show();
    },

    addSelected: function() {
      // add SNPs or strains depending on which toggle is on
      var active = $("#filterRadio .ui-state-active").attr("for");
      if (active === "radioSNPs") {
        $("#exclSNPs ul .ui-selected").appendTo($("#inclSNPs ul"));
      }
      else {
        $("#exclStrains ul .ui-selected").appendTo($("#inclStrains ul"));
      }
    },

    removeSelected: function() {
      // remove SNPs or strains depending on which toggle is on
      var active = $("#filterRadio .ui-state-active").attr("for");
      if (active === "radioSNPs") {
        $("#inclSNPs ul .ui-selected").appendTo($("#exclSNPs ul"));
      }
      else {
        $("#inclStrains ul .ui-selected").appendTo($("#exclStrains ul"));
      }
    },

    applyFilters: function() {
      // get excluded lists from the dialog
      var exclStrainsLi = $("#exclStrains ul li");
      var newExclStrains = _.map(exclStrainsLi, function(li, idx) {
        return $(li).text();
      });
      var exclSNPsLi = $("#exclSNPs ul li");
      var newExclSNPs = _.map(exclSNPsLi, function(li, idx) {
        return $(li).text();
      });
      // feed them back to the model
      var displayData = this.model.get("displayData");
      displayData.filters.strains.excl = newExclStrains;
      displayData.filters.SNPs.excl = newExclSNPs;
      this.model.set({"displayData": displayData});
      this.model.updateDisplayData();
    }
  });

  // model for all the data
  var DataModel = Backbone.Model.extend({

    defaults: {
      "socket": io.connect("http://localhost"),
      "rangeLimit": 20000,
      "rangeExceeded": false,
      "bufferX": 5,
      "pos": {
        "chrom": "Chr1",
        "starts": 3500,
        "ends": 6000
      },
      "bufferData": {
          starts: 0,
          ends: 0,
          chrom: "",
          SNPs: {},
          loci: {},
          refseq: ""
          },
      "displayData": {
        waiting: true,
        loci: [],
        SNPs: [],
        features: [],
        haplotypes: [],
        refseq: "",
        filters: {
          SNPs: {
            incl: [],
            excl: []
          },
          strains: {
            incl: [],
            excl: []
          }
        }
        }
    },

    initialize: function() {
      _.bindAll(this, "updatePosition", "updateDisplayData",
        "waitForData", "updateBufferData", "importData",
        "isLocusInRegion", "isFeatureInRegion", "calcHaplotypes",
        "goToFeature", "goToFeatureRegion",  "cluster");

      this.updateBufferData();

      // update the model when position chnages
      this.bind("change:pos", function() {
        this.updatePosition();
      });
      // when data come back
      this.get("socket").on("data", this.importData);
      this.get("socket").on("featureRegion", this.goToFeatureRegion);
      this.get("socket").on("geneModels", this.importData);
    },

    importData: function(data) {
      var bufferData = this.get("bufferData");
      bufferData.chrom = data.region.chrom;
      bufferData.starts = data.region.start;
      bufferData.ends = data.region.end;
      if (!this.get("rangeExceeded")) {
        bufferData.SNPs = _.filter(data.features, function(f) {
          return f.type.match(/SNP_/);
        });
        bufferData.refseq = data.refseq;
      }
      bufferData.features = data.features;

      this.set({"bufferData": bufferData});
      if (this.get("displayData").waiting) {
         this.updateDisplayData();
         this.waitForData(false); // check if it works properly
      }
    },

    goToFeature: function(name, flank) {
      this.waitForData(true);
      this.get("socket").emit("getFeatureRegion", {"name": name, "flank": flank});
    },

    goToFeatureRegion: function(region) {
      var pos = this.get("pos");
      pos.starts = region.start;
      pos.ends = region.end;
      pos.chrom = region.chrom;
      this.set({"pos": pos});
      this.trigger("change:pos");
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

      // if the region is to big stop displaying hapltypes
      if (span > this.get("rangeLimit")) {
        this.set({"rangeExceeded": true});
      } else {
        if (this.get("rangeExceeded")) {
          this.waitForData(true);
          this.set({"rangeExceeded": false});
        }
      }

      // check if there is a need for fetching new buffer
      var startToClose = (bufferData.starts > 0) &&
        (bufferData.starts > (pos.starts - span));
      var endToClose = (pos.ends + span) > bufferData.ends;
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
      newBufferStart = start >= 0 ? start : 1;
      newBufferEnd = pos.ends + flank;
      var region = {chrom: pos.chrom, start: newBufferStart, end: newBufferEnd};
      console.log(this.get("rangeExceeded"))
      if (this.get("rangeExceeded")) {
        this.get("socket").emit("getGeneModels", region);
      } else {
        this.get("socket").emit("getData", region);
      }
    },

    updateDisplayData: function() {
      var bufferData = this.get("bufferData");
      // first fetch the fragment from the buffer
      var displayData = this.get("displayData");

      // get features
      var features = bufferData.features;
      displayData.features = _.select(features, this.isFeatureInRegion);

      // if range exceeded save just features and return
      if (this.get("rangeExceeded")) {
        // set obtained data to the model
        this.set({"displayData": displayData});
        this.trigger("change:displayData:clusters");
        return;
      }

      // get SNPs
      var SNPs = bufferData.SNPs;
      var pos = this.get("pos");
      displayData.SNPs = _.select(SNPs, function(snp) {
        return ((snp.start >= pos.starts) && (snp.start <= pos.ends));
      });

      // for filtring get list of strains and snsp
      var snpAttr = _.pluck(displayData.SNPs, "attributes");
      var strainList = _.pluck(snpAttr, "Strain").sort();
      strainList = _.uniq(strainList, true);
      var newStrainIncl = _.difference(strainList,
        displayData.filters.strains.excl);
      displayData.filters.strains.incl = newStrainIncl;
      // and SNPs
      var snpIDList = _.pluck(snpAttr, "ID");
      var newSNPIncl = _.difference(snpIDList,
        displayData.filters.SNPs.excl);


      // set them in the model
      displayData.filters.strains.incl = newStrainIncl;
      displayData.filters.SNPs.incl = newSNPIncl.sort(
        function(a, b) {return a - b;});

      // select SNPs again according to strain and SNP ID restictions
      displayData.SNPs = _.select(SNPs, function(snp) {
        return (_.include(newStrainIncl, snp.attributes.Strain) &&
          _.include(newSNPIncl, snp.attributes.ID));
      });

      // get refseq fragment
      var refseq = bufferData.refseq;
      var sliceStart = pos.starts - bufferData.starts;
      var sliceEnd = pos.ends - bufferData.starts + 1;
      refseq = refseq.slice(sliceStart, sliceEnd);

      displayData.refseq = refseq;

      // set obtained data to the model
      this.set({"displayData": displayData});

      // calculate haplotypes from SNPs in the region
      this.calcHaplotypes();

      // cluster haplotypes
      this.cluster();
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
    },

    cluster: function() {

      var metric = function(hapl1, hapl2){
        var score = 5;
        var snps1 = hapl1.snps;
        var snps2 = hapl2.snps;
        var snpDiff = _.union(_.keys(snps1), _.keys(snps2));
        var dist = _.reduce(snpDiff, function(memo, idx) {
          if (snps1[idx] === snps2[idx]) {
            return memo;
          } else return (memo += score*score);
        }, 0);
        dist = Math.sqrt(dist);
        return dist;
      };

      var haplotypes = this.get("displayData").haplotypes;
      // reduce haplotypes to list of objects
      // also add a list of strains for each haplotype
      haplotypes = _.toArray(haplotypes);
      haplotypes = _.reduce(haplotypes, function(memo, hapl) {
        var strains = _.pluck(hapl, "name");
        delete hapl[0].name;
        hapl[0].strains = strains;
        memo.push(hapl[0]);
        return memo;
      }, []);

      var clusters = {};
      if (_.size(haplotypes) > 1) {
      clusters = clusterfck.hcluster(haplotypes, metric,
            clusterfck.AVERAGE_LINKAGE)[0];
      }

     // put clusters into the model
     var displayData = this.get("displayData");
     // displayData.haplotypes = haplotypes;
     displayData.clusters = clusters;
     this.set({displayData: displayData});

     this.trigger("change:displayData:clusters");
    }

  });

  var VisView = Backbone.View.extend({

    initialize: function() {
      _.bindAll(this, "render", "draw", "drawGeneModels", "drawHaplotpes",
                "drawScaleBars", "drawTree", "turnOffHaplotypes", "isLeaf",
                "leaf2haplotype", "turnOnHaplotypes",
                "onSNPmouseOver", "onSNPmouseOut", "onHaplCLick",
                "showCodingSNPs", "showNonCodingSNPs", "showAllSNPs");

      this.trackH = 20;
      this.glyphH = 12;
      this.glyphT = 4;
      this.width = $(window).width()/2 - 20;
      this.height = 10000;
      this.left = 5;
      this.right = 5;
      this.top = 20;
      this.bottom = 4;

      this.model.bind('change:displayData:clusters', this.draw);
      // this.model.bind('change:rangeExceeded', this.draw);

      this.render();
    },

    render: function() {

      // allign properly elements
      var winWidth = $(window).width();
      this.width = winWidth/2 - 20;
      $("#tree").css("width", winWidth/2 - 5);
      $("#chart").css("width", winWidth/2 - 5);

      // browser div
      this.svg = d3.select("#chart").append("svg:svg")
          .attr("class", "chart")
          .attr("width", this.left + this.width + this.right)
          .attr("height", this.top + this.height + this.bottom)
        .append("svg:g")
          .attr("transform", "translate(" + this.left + "," + this.top + ")");

          // tree div
      this.svgTree = d3.select("#tree").append("svg:svg")
          .attr("class", "tree")
          .attr("width", this.left + this.width + this.right)
          .attr("height", this.top + this.height + this.bottom)
        .append("svg:g")
          .attr("transform", "translate(" + this.left + "," + this.top + ")");

      $("#codingRadio").buttonset();
      $("#radioCoding").click(this.showCodingSNPs);
      $("#radioNonCoding").click(this.showNonCodingSNPs);
      $("#radioAllSNPs").click(this.showAllSNPs);
      $("#radioAllSNPs").click();
      // this.draw();
      return this;
    },

    showCodingSNPs: function() {
      //fetch all coding snp
      var snps = this.model.get('displayData').SNPs;
      var codingSNPs = _.filter(snps, function(snp) {
        return snp.attributes.coding;
      });
      var codingPos = _.pluck(codingSNPs, "start");
      var SNPCircles = this.svg.selectAll('.SNP')
        .transition().duration(200)
        .style("opacity", function(d) {
          if (_.include(codingPos, d.x)) return 0.6;
          else return 0.1;
        });
    },

    showNonCodingSNPs: function() {
      //fetch all coding snp
      var snps = this.model.get('displayData').SNPs;
      var codingSNPs = _.filter(snps, function(snp) {
        return snp.attributes.coding;
      });
      var codingPos = _.pluck(codingSNPs, "start");
      var SNPCircles = this.svg.selectAll('.SNP')
        .transition().duration(200)
        .style("opacity", function(d) {
          if (_.include(codingPos, d.x)) return 0.1;
          else return 0.6;
        });
    },
    showAllSNPs: function() {
      //fetch all coding snp
      var snps = this.model.get('displayData').SNPs;
      var codingSNPs = _.filter(snps, function(snp) {
        return snp.attributes.coding;
      });
      var codingPos = _.pluck(codingSNPs, "start");
      var SNPCircles = this.svg.selectAll('.SNP')
        .transition().duration(200)
        .style("opacity", function(d) {
          return 0.6;
        });
    },

     draw: function() {
      var pos = this.model.get("pos");
      var rangeExceeded = this.model.get("rangeExceeded");
      var width = this.width;

      // recalculate scale for new region
      this.x = d3.scale.linear().domain([pos.starts, pos.ends])
                                .range([0, width]);

      var displayData = this.model.get("displayData");
      this.svg.selectAll('.message').remove();
      this.drawGeneModels(displayData);
      if (!rangeExceeded) {
        this.turnOnHaplotypes();
        this.drawTree();
        this.drawHaplotpes();
      } else {
        this.turnOffHaplotypes();
      }
      this.drawScaleBars();
     },

     drawGeneModels: function(displayData) {
      var x = this.x;

      // draw loci
      // get genes from all features
      // var features = displayData.features;
      var genes = _.select(displayData.features, function(feature) {
        return feature.type === "gene";
      });

      var freePos = this.glyphT;
      var glyphH = this.glyphH;
      var trackH = this.trackH;

      var geneRect = this.svg.selectAll('.gene').data(genes);
      geneRect.attr("x", function(d) { return x(d.start); })
              .attr("width", function(d) { return x(d.end) - x(d.start); });
      geneRect.enter().append("svg:rect")
              .attr("class", "gene")
              .attr("height", glyphH)
              .attr("x", function(d) { return x(d.start); })
              .attr("y", freePos)
              .attr("width", function(d) { return x(d.end) - x(d.start); })
              .attr("fill", "chartreuse");
      geneRect.exit().remove();

      // draw gene labels
      var geneLabel = this.svg.selectAll(".geneLabel").data(genes);
      geneLabel.attr("x", function(d) {
                  // display label even when gene starts before region
                  return (x(d.start) > 5) ? x(d.start) : 5;
                })
                .text(function(d) { return d.attributes.Name; });
      geneLabel.enter().append("svg:text")
                .attr("class", "geneLabel")
                .attr("x", function(d) {
                  // display label even when gene starts before region
                  return (x(d.start) > 3) ? x(d.start) : 3;
                })
                .attr("y", freePos)
                .attr("dy", "1.075em")
                .attr("dx", "0.5em")
                .text(function(d) { return d.attributes.Name; });
      geneLabel.exit().remove();

      // update free position
      freePos += this.trackH;

      // extract data needed to construct gene models
      var UTR5s = _.select(displayData.features, function(feature) {
        return feature.type === "five_prime_UTR";
      });
      var UTR3s = _.select(displayData.features, function(feature) {
        return feature.type === "three_prime_UTR";
      });
      var CDSs = _.select(displayData.features, function(feature) {
        return feature.type === "CDS";
      });

      // function for determining the position on y axis
      var yPos = function(d) {
        var nModel = d.attributes.Parent.split(",")[0].split(".")[1] || 1;
        return freePos + (nModel - 1)*trackH;
      };

      // draw gene models
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
      this.maxModels = maxModels;
      freePos += trackH*maxModels;

      // update free pos
      this.freePos = freePos;
     },

    drawHaplotpes: function() {
      var pos = this.model.get("pos");
      var width = this.width;
      var freePos = this.freePos;
      var glyphH = this.glyphH;
      var glyphT = this.glyphT;
      var trackH = this.trackH;
      var x = this.x;

      // get SNPs with haplotype indexes
      this.hapSNPs = _.reduce(this.leaves, function(memo, leaf) {
        _.each(leaf.snps, function(base, pos) {
         var snp = {
           x: pos,
           y: leaf.x,
           base: base
         };
         memo.push(snp);
        });
        return memo;
      }, []);

      // draw haplotypes
      var haplotypeBars = this.svg.selectAll('.hap').data(this.leaves);
      haplotypeBars.attr('y', function(d) { return d.x + freePos - trackH/2;});
      haplotypeBars.enter().append('svg:rect')
              .attr('class', 'hap')
              .attr('height', glyphH)
              .attr('width', width)
              .attr('x', x(pos.starts))
              .attr('y', function(d) { return d.x + freePos - trackH/2;})
              .on('click', this.onHaplCLick);
      haplotypeBars.exit().remove();

      // draw SNPs
      var SNPCircles = this.svg.selectAll('.SNP').data(this.hapSNPs);
      SNPCircles.attr('cx', function(d) { return x(d.x); })
                .attr('cy', function(d) {
                  return d.y + freePos - glyphT;
                  })
                .attr('fill', this.baseColor)
                .attr('opacity', 0.6);
      SNPCircles.enter().append('svg:circle')
                .attr('class', 'SNP')
                .attr('r', glyphH/4)
                .attr('cx', function(d) { return x(d.x); })
                .attr('cy', function(d) {
                    return d.y + freePos - glyphT;
                  })
                .attr('fill', this.baseColor)
                .on("mouseover", this.onSNPmouseOver)
                .on("mouseout", this.onSNPmouseOut);
      SNPCircles.exit().remove();

      // fade in/out snps according to whats chosen on toggles
      var activeToggle = $("#codingRadio .ui-state-active").attr("for");
      if (activeToggle === "radioNonCoding") this.showNonCodingSNPs();
      else if (activeToggle === "radioCoding") this.showCodingSNPs();
      else this.showAllSNPs();

      //update free position
      var haplotypes = this.model.get("displayData").haplotypes;
      freePos += _.size(haplotypes)*trackH;
      this.freePos = freePos;
    },

    drawScaleBars: function() {
      // this.height = (1 + maxModels + _.size(haplotypes))*trackH;
      var pos = this.model.get("pos");
      var height = this.freePos;
      var width = this.width;

      this.x = d3.scale.linear().domain([pos.starts, pos.ends])
                                .range([0, width]);
      var x = this.x;

      var rules = this.svg.selectAll('g.rule')
          .data(x.ticks(10), String);
      this.svg.selectAll('.ruleLine')
          .attr("y2", height);

      rules.attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});
      var newRules = rules.enter().append('svg:g')
          .attr('class', 'rule')
          .attr('transform', function(d) {return 'translate(' + x(d) + ',0)';});
      newRules.append('svg:line')
          .attr("class", "ruleLine")
          .attr('y1', 0)
          .attr('y2', height);
      newRules.append("svg:text")
          .attr('y', -10)
          .attr('dy', '.71em')
          .attr('text-anchor', 'middle')
          .text(x.tickFormat(10));
      rules.exit().remove();
    },

     turnOffHaplotypes: function() {
      // remove all haplotype specific stuff
      this.svg.selectAll('.hap').remove();
      this.svg.selectAll('.SNP').remove();
      $("#tree").hide();
      var winWidth = $(window).width();
      this.width = winWidth - 20;
      $("#chart").css("width", winWidth - 5);
      $(".chart").attr("width", this.left + this.width + this.right);

      var message = "Displayed region exceeds " +
        this.model.get("rangeLimit")/1000 + " kb and haplotype clustering has been turned off.";
      this.svg.append("svg:text")
        .attr('class', 'message')
        .attr('anchor', 'middle')
        .attr('y', this.freePos + this.trackH)
        .text(message);
     },

     turnOnHaplotypes: function() {
       var winWidth = $(window).width();
       this.width = winWidth/2 - 20;

       $("#chart").css("width", winWidth/2 - 5);
       $(".chart").attr("width", this.left + this.width + this.right);
       $("#tree").show();
     },

     drawTree: function() {

       var topTranslation = (this.maxModels + 1) * this.trackH;
       var top = this.top + topTranslation;

       this.svgTree
        .attr("transform", "translate(" + this.left + "," + top + ")");

       var displayData = this.model.get("displayData");
       var haplotypes = displayData.haplotypes;
       var clusters = displayData.clusters;
       var height = _.size(haplotypes) * this.trackH;

      var cluster = d3.layout.cluster()
        .size([height, this.width + this.left]);
      cluster.separation(function(a, b) { return 1; });
      cluster.children(function(d) {
          if (d) return (d.children = _.compact([d.left , d.right]));
        });

      var diagonal = d3.svg.diagonal()
          .projection(function(d) {return [d.y, d.x]; });

      var nodes = cluster.nodes(clusters);

      var link = this.svgTree.selectAll("path.link")
          .data(cluster.links(nodes));

      link.attr("d", diagonal);
      link.enter().append("svg:path")
          .attr("class", "link")
          .attr("d", diagonal);
      link.exit().remove();

      var node = this.svgTree.selectAll("g.node").data(nodes);
      node.attr("transform", function(d) {
        return "translate(" + d.y + ", " + d.x + ")";
      });
      node.enter().append("svg:g")
          .attr("class", "node")
          .attr("transform", function(d) {
            return "translate(" + d.y + ", " + d.x + ")";
          });
      node.append("svg:circle")
        .attr("class", "nodeCircle")
        .attr("r", this.glyphH/2 - 1.5);
      node.exit().remove();

      // save leaf nodes so that haplotypes can be arranged acordingly
      // to clustering by d3
      var leaves = _.select(nodes, this.isLeaf);
      this.leaves = _.map(leaves, this.leaf2haplotype);
     },

     onSNPmouseOver: function(d, i) {
       var freePos = this.freePos;
       var pos_x = d.x;
       var tx = this.x(d.x);
       var ty = d.y + freePos - this.glyphH*0.75;

       //make circle bigger
       d3.select(d3.event.target)
          .transition()
            .duration(200)
            .attr("r", this.glyphH/2);

       console.log(d3.event);
       // show the position of the SNP
       var g = d3.select(d3.event.target.parentNode);
       g.append("svg:text")
         .attr("class", "snpTip")
         .attr("x", tx)
         .attr("y", ty)
         .attr('text-anchor', 'middle')
         .text(pos_x);

       // fade out the haplotypes that do not have this SNP
       var posWithSNP =   _.reduce(this.hapSNPs, function(memo, snp) {
           if (snp.x === pos_x) memo.push(snp.y);
           return memo;
         }, []);

       d3.selectAll(".hap")
       .transition()
        .duration(200)
        .style("opacity", function(d) {
         if (_.include(posWithSNP, d.x)) return 0.2;
         else return 0.1;
       });

       d3.selectAll(".nodeCircle")
        .transition()
          .duration(200)
          .style("fill", function(d) {
            if ((_.size(d.children) === 0) && _.include(posWithSNP, d.x)) {
              return "steelblue";
            }
            else return "#fff";
          });
      },

     onSNPmouseOut: function(d, i) {
       var g = d3.select(d3.event.target.parentNode);

       // make circle smaller
       d3.select(d3.event.target)
          .transition()
            .duration(200).attr("r", this.glyphH/4);

       // remove the SNP tip
       g.selectAll(".snpTip").remove();
       // fade to the original state
       d3.selectAll(".hap")
        .transition()
          .duration(200)
          .style("opacity", 0.2);
       d3.selectAll(".nodeCircle")
        .transition()
          .duration(200)
          .style("fill", "#fff");
     },

     onHaplCLick: function(d, i) {
       // when haplotype bar is clicked open the dialog with the
       // details about the haplotype
       // all dialogs use the clone of the same div

       var pos = this.model.get("pos");
       var snpStr = "";
       _.each(d.snps, function(snp, pos){
         snpStr += pos + ": " + snp + ", ";
       });
       var posStr = "Chr" + pos.chrom + ":" + pos.starts + ".." + pos.ends;

       var haplDialog = $("#haplDialog").clone().dialog({
         title: 'Haplotype for ' + posStr,
         close: function(ev, ui) {
           $(this).remove();
         }
       });

       $(haplDialog).find("p:first").append("</br> " + d.strains);
       $(haplDialog).find("p:eq(1)").append("</br> " + snpStr);
       var refseq = this.model.get("displayData").refseq;
       var fastaStr = ">" + posStr + "\n";
       _.each(refseq.split(""), function(base, idx, seq){
         var idxPos = pos.starts + idx;
         if (_.include(_.keys(d.snps), idxPos.toString())) {
           var variant = d.snps[idxPos];
           base = "[" + base + "/" + variant + "]";
         }
         if ((idx+1) % 60 === 0) base += "\n";
         fastaStr += base;
       });

       $(haplDialog).find("textarea").val(fastaStr);
       $(haplDialog).find("#saveFasta").click(function() {
         var bb = new BlobBuilder();
         bb.append(fastaStr);
         var fname = $(haplDialog).find("#fastaFileName").val() + ".fas";
         saveAs(bb.getBlob("text/plain;charset=utf-8"), fname);
       });
     },

     isLeaf: function(node) {
       if (_.size(node.children) === 0) return true;
       else return false;
     },

     leaf2haplotype: function(leaf) {
       leaf.snps = leaf.canonical.snps;
       leaf.strains = leaf.canonical.strains;
       delete leaf.canonical;
       return leaf;
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

    var navigateView = new NavigateView({
      el: $("#navigate"),
      model: dataModel
    });

    // initialize router
    var appRouter = new AppRouter({model: dataModel});
    Backbone.history.start();

    var visView = new VisView({
      el: $("#chart"),
      model: dataModel
    });

    var controlsView = new ControlsView({
      el: $("#controls"),
      model: dataModel
    });

  });

}
)(jQuery);

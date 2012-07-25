(function ($, Backbone, window, _, io, clusterfck, BlobBuilder, location, d3,
          saveAs, document, localStorage) {
  'use strict';
  // all vars
  var AppRouter, ChoiceView, MenuView, NavigateView;
  // router stuff

  AppRouter = Backbone.Router.extend({

    initialize: function (options) {
      _.bindAll(this, "moveModel", "navigateTo", "navigateToInitial");
      this.model = options.model;

      // this.navigateTo();
      // when model changes, navigate to new place
      this.model.on("change:pos", this.navigateTo);

      // setup initial location
      this.navigateToInitial();
    },

    routes: {
      "goto/:genome/:ch/start:s/end:e": "moveModel"
    },

    moveModel: function (genome, ch, s, e) {
      var pos = {
        "genome": genome,
        "chrom": ch,
        "starts": parseInt(s, 10),
        "ends": parseInt(e, 10)
      };
      this.model.set({"pos": pos});
    },

    navigateTo: function () {
      var pos, path;
      pos = this.model.get("pos");
      path = "goto/" + pos.genome + "/" + pos.chrom + "/start" +
        pos.starts + "/end" + pos.ends;
      this.navigate(path);
    },

    navigateToInitial: function() {
      // this.navigateTo();
    }
  });

  // Views

  MenuView = Backbone.View.extend({
    initialize: function () {
      _.bindAll(this, "render", "setRefGen", "toggleSpinner", "setLocation",
               "openGoToFeatureDialog", "go", "findFeature",
               "openFilterDialog", "drawTable", "onExcludeSelected",
               "onIncludeSelected", "onSelectAll");

      this.model.on("change:displayData", this.toggleSpinner);
      this.model.on("change:pos", this.setLocation);
      this.render();
    },

    render: function () {
      $('#menu').wijmenu();

      $(window).scroll(function () {
        $('#mobile-menu-plus').css({'position': 'fixed', 'z-index': 2,
          'top': 0, 'left': 0, 'right': 0});
      });

      // hide dialogs
      $("#goToFeatureDialog").hide();
      $("#filterDialog").hide();
      this.setLocation();
      var socket = this.model.get("socket");
      socket.emit("getRefList");
      socket.on("refList", this.setRefGen);
    },

    events: {
      "click #go": "go",
      "click #goToFeature": "openGoToFeatureDialog",
      "click #filter": "openFilterDialog"
    },
    
    findFeature: function() {
      var genome = $("#feature-genome").val();
      var name = $("#feature-name").val();
      var flanks = parseInt($("#feature-flanks").val(), 10);
      this.model.goToFeature(genome, name, flanks);
    },

    openGoToFeatureDialog: function() {
      $("#find").button().click(this.findFeature);

      $("#goToFeatureDialog").dialog(
          {title: "Find faeture of interest."}       
        );
    },

    go: function() {
      var pos = {};
      pos.genome = $("#loc-genome").val();
      pos.chrom =  $("#loc-chrom").val();
      pos.starts =  parseInt($("#loc-start").val(), 10);
      pos.ends = parseInt($("#loc-end").val(), 10);
      this.model.set({"pos": pos});
    },

    openFilterDialog: function() {

      $(document).on("click", "#excludeSelected", this.onExcludeSelected);
      $(document).on("click", "#includeSelected", this.onIncludeSelected);

      this.filterDialog = $("#filterDialog").clone().dialog({
        title: "Filter input data",
        minWidth: 600,
        close: function(ev, ui){ $(this).remove(); }
      });
      
      this.drawTable();
    },

    onExcludeSelected: function() {
      // get IDs of selected SNPs
      var excluded = [];
      $(".filterTable .rselect :nth-child(7n-6)").each(
        function() {excluded.push($(this).text());}
      );
      // annotate excluded SNPs
      var displayData = this.model.get("displayData");
      var SNPs = _.map(displayData.SNPs, function(snp) {
        if (_.include(excluded, snp.attributes.ID)) {
          snp.attributes.included = false;
        }
        return snp; 
      });
      // update model
      displayData.SNPs = SNPs;
      this.model.set("displayData", displayData);
      this.drawTable();
    },

    onIncludeSelected: function() {
      var included = [];
      $(".filterTable .rselect :nth-child(7n-6)").each(
        function() {included.push($(this).text());}
      );
      // annotate excluded SNPs
      var displayData = this.model.get("displayData");
      var SNPs = _.map(displayData.SNPs, function(snp) {
        if (_.include(included, snp.attributes.ID)) {
          snp.attributes.included = true;
        }
        return snp; 
      });
      // update model
      displayData.SNPs = SNPs;
      this.model.set("displayData", displayData);
      this.drawTable();
    },

    onSelectAll: function() {
      

    },

    drawTable: function() {
      $('.dataTables_wrapper').remove();
      // fetch SNP data and prepare a table
      var displayData = this.model.get("displayData");
      var SNPs = _.map(displayData.SNPs, function(snp) {
        if (snp.attributes.included === undefined) {
          snp.attributes.included = true;
        }
        return snp;
      }); 
      console.log(SNPs);
      var tableHead = "<table class='filterTable'>";
      tableHead += "<thead><tr><th>ID</th><th>Change</th><th>Chrom</th>";
      tableHead += "<th>Pos</th><th>Score</th><th>Accession</th><th>included</th>";
      tableHead += "</tr></thead><tbody>";
      
      var SNPString = _.reduce(SNPs, function(memo, snp) {
        var a = snp.attributes;
        memo += "<tr>";
        memo += "<td>" + a.ID + "</td>";
        memo += "<td>" + a.Change + "</td>";
        memo += "<td>" + snp.seqid + "</td>";
        memo += "<td>" + snp.start + "</td>";
        memo += "<td>" + snp.score + "</td>";
        memo += "<td>" + a.Strain + "</td>";
        // asign different classes for true and false
        if (a.included) {memo += "<td class='included-row'>";}
        else {memo += "<td class='excluded-row'>";}
        memo += String(a.included) + "</td>";
        memo += "</tr>";
        return memo;
      }, tableHead);
      SNPString += "</tbody></table>"; 
      
      $(this.filterDialog).find("p:first").append(SNPString);
      $('.filterTable tr').click( function() {
        $(this).toggleClass('rselect');
      });
      $('.filterTable').dataTable({
        "bJQueryUI": true,
      "sPaginationType": "full_numbers"});
    },

    setLocation: function() {
      var pos = this.model.get("pos");  
      $("#loc-genome").val(pos.genome);
      $("#loc-chrom").val(pos.chrom);
      $("#loc-start").val(pos.starts);
      $("#loc-end").val(pos.ends);
    },

    setRefGen: function (refList) {
      $('#loc-genome').autocomplete({source: refList});
    },

    toggleSpinner: function () {
      var displayData = this.model.get("displayData");
      if (displayData.waiting === true) {
        $("#loading-spinner").show();
      } else {
        $("#loading-spinner").hide();
      }
    }

  });

  NavigateView = Backbone.View.extend({

    initialize: function() {
      _.bindAll(this, "render",
      "goLeft", "zoomOut", "zoomIn", "goRight");
      this.step = 5;
      this.render();
    },

    render: function() {
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
          "genome": pos.genome,
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
          "genome": pos.genome,
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
          "genome": pos.genome,
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
          "genome": pos.genome,
          "starts": starts,
          "ends": ends,
          "chrom": pos.chrom
        }
      };
      this.model.set(update);
    }
  });

  // model for all the data
  var DataModel = Backbone.Model.extend({

    defaults: {
      "rangeLimit": 20000,
      "rangeExceeded": false,
      "bufferX": 5,
      "pos": {
        "genome": "",
        "chrom": "",
        "starts": 0,
        "ends": 0,
      },
      "strains": [],
      "bufferData": {
        genome: "",
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
      "goToFeature", "goToFeatureRegion",  "cluster", "importStrains",
      "getStrains", 'reloadData', 'savePosition', "loadLocation");

      this.loadLocation();      

      var appAddress = 'http://' + $('#hostip').val();
      this.set({socket: io.connect(appAddress)});

      this.updateBufferData();
      this.getStrains();

      // update the model when position chnages
      this.on("change:pos", function() {
        this.updatePosition();
        this.savePosition();
      });
      // when data come back
      this.get("socket").on("data", this.importData);
      this.get("socket").on("featureRegion", this.goToFeatureRegion);
      this.get("socket").on("geneModels", this.importData);
      this.get("socket").on("strains", this.importStrains);
    },

    loadLocation: function() {
      var pos = {};
        pos.genome = localStorage.getItem("genome");
        pos.chrom = localStorage.getItem("chrom");
        pos.starts = parseInt(localStorage.getItem("starts"), 10);
        pos.ends = parseInt(localStorage.getItem("ends"), 10);
        if (!pos.genome) {
        pos.genome = "TAIR10";
        pos.chrom = "Chr1";
        pos.starts = 10000;
        pos.ends = 15000;
      }
      this.set({"pos": pos});
    },

    importData: function(data) {
      var bufferData = this.get("bufferData");
      bufferData.genome = data.region.genome;
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

    importStrains: function(data) {
      this.set({"strains": data});
    },

    goToFeature: function(genome, name, flanks) {
      this.waitForData(true);
      this.get("socket").emit("getFeatureRegion",
        {"genome": genome, "name": name, "flank": flanks});
    },

    goToFeatureRegion: function(region) {
      var pos = this.get("pos");
      pos.genome = region.genome;
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

    getStrains: function() {
      var genome = this.get('pos').genome;
      this.get("socket").emit("getStrains", genome);  
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
      var otherGenome = pos.genome !== bufferData.genome;
      // if there is fetch
      if (startToClose || endToClose || otherChromosome || otherGenome) {
        this.updateBufferData();
      }

      // check if new position is in buffer
      var startInBuffer = pos.starts >= bufferData.starts;
      var endInBuffer = pos.ends <= bufferData.ends;
      // if it is import otherwise say waiting
      if (startInBuffer && endInBuffer && !otherChromosome) {
        this.updateDisplayData();
      }
      else {this.waitForData(true);}
    },

    savePosition: function() {
      var pos = this.get("pos");
      localStorage.setItem("genome", pos.genome);
      localStorage.setItem("chrom", pos.chrom);
      localStorage.setItem("starts", pos.starts);
      localStorage.setItem("ends", pos.ends);
    },

    updateBufferData: function() {
      var pos, span, flank, start, newBufferStart, newBufferEnd;
      pos = this.get("pos");
      span = pos.ends - pos.starts;
      flank = (this.get("bufferX") - 1) * span/2;
      start = pos.starts - flank;
      newBufferStart = start >= 0 ? start : 1;
      newBufferEnd = pos.ends + flank;
      var region = {
        genome: pos.genome, chrom: pos.chrom,
        start: newBufferStart, end: newBufferEnd
        };
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

    reloadData: function() {
      this.waitForData(true);
      var pos = this.get('pos');
      var region = {"chrom": pos.chrom, "start": pos.starts, "end": pos.ends};
      this.get("socket").emit("getStrains");
      this.get("socket").emit("getData", region);
    },

    isLocusInRegion: function(locus) {
      var pos = this.get("pos");
      if(locus.gene.start <= pos.ends && locus.gene.end >= pos.starts) {
        return true;
      }
      return false;
    },

    isFeatureInRegion: function(feature) {
      var pos = this.get("pos");
      if(feature.start <= pos.ends && feature.end >= pos.starts) {
        return true;
      }
      return false;
    },

    calcHaplotypes: function() {

      var displayData = this.get("displayData");
      var SNPs = displayData.SNPs;
      
      // create strains object
      var strains = _.reduce(SNPs, function(memo, snp) {
        var strain = snp.attributes.Strain;
        var idx = snp.start;
        var variant = snp.attributes.Change.split(":")[1];
        var refBase = snp.attributes.Change.split(":")[0];
        var variantArr = (memo[strain] || []);
        var refArr = (memo.refStrain || []);
        variantArr[idx] = variant;
        refArr[idx] = refBase;
        memo[strain] = variantArr;
        memo.refStrain = refArr;
        return memo;
      }, {});
      var allStrains = this.get('strains');
      var nonRef = _.keys(strains);
      var refLike = _.difference(allStrains, nonRef);
      var refStrainSNPs = strains.refStrain;
      _.each(refLike, function(rfs) {
        strains[rfs] = refStrainSNPs;
      });

      // group strains by snps
      var haplotypes = {};
      _.each(strains, function(strainSNPs, strainName, strains) {
        var haplID = _.zip(_.keys(strainSNPs), _.compact(strainSNPs)).join();
        var haplotype = (haplotypes[haplID] || []);
        haplotype.push({name: strainName, snps: strainSNPs});
        haplotypes[haplID] = haplotype;
      });
      // make an array of ref-like strains
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
          }
          return (memo += score*score);
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
      _.bindAll(this, "render", "draw", "drawTraits", "drawGeneModels", "drawHaplotpes",
        "drawScaleBars", "drawTree", "turnOffHaplotypes", "isLeaf",
        "leaf2haplotype", "turnOnHaplotypes",
        "onSNPmouseOver", "onSNPmouseOut", "onSNPClick", "onHaplCLick",
      "showCodingSNPs", "showNonCodingSNPs", "showAllSNPs", "drawLegend");

      this.trackH = 20;
      this.glyphH = 12;
      this.glyphT = 4;
      this.height = 10000;
      this.padding = 5; 
      this.left = 45;
      this.right = 20;
      this.width = $(window).width()/2 - this.left - this.right - this.padding;
      this.top = 20;
      this.bottom = 4;
      this.model.on('change:displayData:clusters', this.draw);
      // this.model.bind('change:rangeExceeded', this.draw);
      var that = this;
      $(window).resize(function(ev) {
        if(ev.target === window) {
          location.reload();
        }
      });
      this.render();
    },

    render: function() {

      // allign properly elements
      var winWidth = $(window).width();
      this.width = winWidth/2 - this.left - this.right - this.padding;  
      $("#tree").css("width", winWidth/2 - this.padding);
      $("#chart").css("width", winWidth/2 - this.padding);

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
      // this.draw();

      // hide haplotype dialog window
      $("#haplDialog").hide();
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
        if (_.include(codingPos, d.x)) {return 0.6;}
        return 0.1;
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
        if (_.include(codingPos, d.x)) {return 0.1;}
        return 0.6;
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

      this.drawTraits(displayData);
      this.drawGeneModels(displayData);
      if (!rangeExceeded) {
        this.turnOnHaplotypes();
        this.drawTree();
        this.drawHaplotpes();
      } else {
        this.turnOffHaplotypes();
      }
      this.drawScaleBars();
      this.drawLegend();
    },
    
    drawTraits: function(displayData) {
      var traits = _.filter(displayData.features, function(feature) {
        return feature.type === "trait";    
      });
      
      var x = this.x;
      var freePos = this.glyphT;
      var glyphH = this.glyphH;
      var trackH = this.trackH;
      var traitRect = this.svg.selectAll('.trait').data(traits);
      traitRect.attr("x", function(d) { return x(d.start); })
      .attr("width", function(d) { return x(d.end) - x(d.start); });
      traitRect.enter().append("svg:rect")
      .attr("class", "trait")
      .attr("height", glyphH)
      .attr("x", function(d) { return x(d.start); })
      .attr("y", freePos)
      .attr("width", function(d) { return x(d.end) - x(d.start); })
      .attr("fill", "palegreen");
      traitRect.exit().remove();

      // draw gene labels
      var traitLabel = this.svg.selectAll(".traitLabel").data(traits);
      traitLabel.attr("x", function(d) {
        // display label even when gene starts before region
        return (x(d.start) > 5) ? x(d.start) : 5;
      })
      .text(function(d) { return d.attributes.Trait; });
      traitLabel.enter().append("svg:text")
      .attr("class", "traitLabel")
      .attr("x", function(d) {
        // display label even when gene starts before region
        return (x(d.start) > 3) ? x(d.start) : 3;
      })
      .attr("y", freePos)
      .attr("dy", "1.075em")
      .attr("dx", "0.5em")
      .text(function(d) { return d.attributes.Trait; });
      traitLabel.exit().remove();

      // update free position
      if (_.size(traits) > 0) {
        freePos += this.trackH;
      }
      this.freePos = freePos;
    },

    drawGeneModels: function(displayData) {
      var x = this.x;

      // draw loci
      // get genes from all features
      // var features = displayData.features;
      var genes = _.select(displayData.features, function(feature) {
        return feature.type === "gene";
      });
      var freePos = this.freePos;
      var glyphH = this.glyphH;
      var trackH = this.trackH;

      var geneRect = this.svg.selectAll('.gene').data(genes);
      geneRect.attr("x", function(d) { return x(d.start); })
      .attr("y", freePos)
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
      .attr("y", freePos)
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
      var allStrains = this.model.get("strains");
      var width = this.width;
      var freePos = this.freePos;
      var glyphH = this.glyphH;
      var glyphT = this.glyphT;
      var trackH = this.trackH;
      var x = this.x;

      this.allSNPs = this.model.get("displayData").SNPs;
      // get SNPs with haplotype indexes
      this.hapSNPs = _.reduce(this.leaves, function(memo, leaf) {
        var strains = leaf.strains;
        _.each(leaf.snps, function(base, pos) {
          var snp = {
            x: pos,
            y: leaf.x,
            base: base,
            strains: strains
          };
          memo.push(snp);
        });
        return memo;
      }, []);

      if (!this.leaves) {
        this.svg.selectAll('.SNP').remove();
        this.svg.selectAll('.hap').remove();
        return;
      }
      
      // draw haplotypes
      var haplotypeBars = this.svg.selectAll('.hap, .refHap').data(this.leaves);
      haplotypeBars.attr('y', function(d) { return d.x + freePos - trackH/2;})
        .attr('class', function(d) {
          if (d.strains[0] === "refStrain" ) {
            return 'refHap';
          }
          return 'hap';
        });
      haplotypeBars.enter().append('svg:rect')
      .attr('class', function(d) {
          if (d.strains[0] === "refStrain" ) {
            return 'refHap';
          }
          return 'hap';
        })
      .attr('height', glyphH)
      .attr('width', width)
      .attr('x', x(pos.starts))
      .attr('y', function(d) { return d.x + freePos - trackH/2;})
      .on('click', this.onHaplCLick);

      haplotypeBars.exit().remove();

      // draw number of strains representing haplotype
      var fracString = function(d) {
        var nAllStains = _.size(allStrains);
        var nHaplStrain = _.size(d.strains);
        var percentStrains = nHaplStrain*100/nAllStains;
        return nHaplStrain + " (" + Math.floor(percentStrains)+ "%)";
      };

      var strainFracs = this.svg.selectAll('.strainFrac').data(this.leaves);
      strainFracs
        .attr('x', x(pos.starts) - this.left)
        .attr('y', function(d) { return d.x + freePos;})
        .text(fracString);
      
      strainFracs.enter().append("text")
        .attr("class", "strainFrac")
        .attr('x', x(pos.starts) - this.left)
        .attr('y', function(d) { return d.x + freePos;})
        .text(fracString)
        .attr('fill', 'steelblue');

      strainFracs.exit().remove();
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
      .on("mouseout", this.onSNPmouseOut)
      .on('click', this.onSNPClick);
      SNPCircles.exit().remove();

      // fade in/out snps according to whats chosen on toggles
      var activeToggle = $("#codingRadio .ui-state-active").attr("for");
      if (activeToggle === "radioNonCoding") {this.showNonCodingSNPs();}
      else if (activeToggle === "radioCoding") {this.showCodingSNPs();}
      else {this.showAllSNPs();}

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
      $("#chart").css("width", winWidth - this.padding);
      $(".chart").attr("width", this.left + this.width + this.right - this.padding);

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
      this.width = winWidth/2 - this.left - this.right - this.padding;

      $("#chart").css("width", winWidth/2 - this.padding);
      $(".chart").attr("width", this.left + this.width + this.right);
      $("#tree").show();
    },

    drawTree: function() {

      var freePos = this.freePos;
      var topTranslation = freePos;
      var top = this.top + topTranslation;

      this.svgTree
      .attr("transform", "translate(" + this.left + "," + top + ")");

      var displayData = this.model.get("displayData");
      var haplotypes = displayData.haplotypes;
      var clusters = displayData.clusters;
      var height = _.size(haplotypes) * this.trackH;

      var cluster = d3.layout.cluster()
      .size([height, this.width]);
      cluster.separation(function(a, b) { return 1; });
      cluster.children(function(d) {
        if (d) {
          return (d.children = _.compact([d.left , d.right]));
        }
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
      if (_.size(leaves) > 1) {
        this.leaves = _.map(leaves, this.leaf2haplotype);
      }
    },

    drawLegend: function(){
      var glyphH = this.glyphH;
      var circleData = [
        [glyphH/2, "red", "A"],
        [glyphH*5.5, "green", "C"],
        [glyphH*10.5, "blue", "G"],
        [glyphH*15.5, "orange", "T"]];

      var rectData = [
        [0, "chartreuse", "gene"],
        [glyphH*5, "slateblue", "5'UTR"],
        [glyphH*10, "teal", "3'UTR"],
        [glyphH*15, "steelblue", "CDS"]];

      var legendCircs = this.svgTree.selectAll('.legendCircs')
        .data(circleData);
      legendCircs.enter().append("svg:circle")
        .attr('class', 'legendCircs')
        .attr('r', glyphH/4)
        .attr('cx', function(d) {return d[0];})
        .attr('cy', 0)
        .attr('fill', function(d) {return d[1];});

      var legendRects = this.svgTree.selectAll('.legendRects')
        .data(rectData);
      legendRects.enter().append("svg:rect")
        .attr('class', "legendRects")
        .attr('height', glyphH)
        .attr('width', glyphH)
        .attr('y', glyphH)
        .attr('x', function(d) {return d[0];})
        .attr('fill', function(d) {return d[1];});

      var textData = [
        [glyphH*1.5, glyphH/4, "A"],
        [glyphH*6.5, glyphH/4, "C"],
        [glyphH*11.5, glyphH/4, "G"],
        [glyphH*16.5, glyphH/4, "T"],
        [glyphH*1.5, glyphH*1.75, "gene"],
        [glyphH*6.5, glyphH*1.75, "5'UTR"],
        [glyphH*11.5, glyphH*1.75, "3'UTR"],
        [glyphH*16.5, glyphH*1.75, "CDS"]
        ];

      var legendText = this.svgTree.selectAll('.legendText')
        .data(textData);
      legendText.enter().append("text")
        .attr('class', 'legendText')
        .attr('x', function(d) {return d[0];})
        .attr('y', function(d) {return d[1];})
        .text(function(d) {return d[2];})
        .attr('fill', 'royalblue');
    },

    onSNPmouseOver: function(d, i) {

      //make circle bigger
      d3.select(d3.event.target)
      .transition()
      .duration(400)
      .attr("r", this.glyphH/2);
        
      // fade out the haplotypes that do not have this SNP
      var posWithSNP =   _.reduce(this.hapSNPs, function(memo, snp) {
        if (snp.x === d.x) {memo.push(snp.y);}
        return memo;
      }, []);

      d3.selectAll(".hap")
      .transition()
      .duration(400)
      .style("opacity", function(d) {
        if (_.include(posWithSNP, d.x)) {return 0.2;}
        return 0.1;
      });

      d3.selectAll(".nodeCircle")
      .transition()
      .duration(400)
      .style("fill", function(d) {
        if ((_.size(d.children) === 0) && _.include(posWithSNP, d.x)) {
          return "steelblue";
        }
        return "#fff";
      });
    },

    onSNPmouseOut: function(d, i) {
      var g = d3.select(d3.event.target.parentNode);

      // make circle smaller
      d3.select(d3.event.target)
      .transition()
      .duration(400).attr("r", this.glyphH/4);

      // fade to the original state
      d3.selectAll(".hap")
      .transition()
      .duration(400)
      .style("opacity", 0.2);
      d3.selectAll(".nodeCircle")
      .transition()
      .duration(400)
      .style("fill", "#fff");
    },

    onSNPClick: function(d, i) {
      // find all SNPs at this position in this haplotype
      var SNPlist = _.filter(this.allSNPs, function(snp) {
        return _.include(d.strains, snp.attributes.Strain) && d.x === snp.start;
      });
      var tableHead = "<table class='SNPtable'><thead><tr><th>ID</th><th>Change</th><th>Chrom</th><th>Pos</th><th>Score</th><th>Accession</th></tr></thead><tbody>";
      var SNPString = _.reduce(SNPlist, function(memo, snp) {
          var a = snp.attributes;
          memo += "<tr>";
          memo += "<td>" + a.ID + "</td>";
          memo += "<td>" + a.Change + "</td>";
          memo += "<td>" + snp.seqid + "</td>";
          memo += "<td>" + snp.start + "</td>";
          memo += "<td>" + snp.score + "</td>";
          memo += "<td>" + a.Strain + "</td>";
          memo += "</tr>";
          return memo;
        }, tableHead);
      SNPString += "</tbody></table>";
      // open a dialog for dipalying info about the SNP
      var SNPDialog = $('#SNPDialog').clone().dialog({
         title: "Single Nucleotide Polymorphism",
         minWidth: 540,
         close: function(ev, ui) {
          $(this).remove(); 
         }
      });
      $(SNPDialog).find("p:first").append("</br> " + SNPString);
      $('.SNPtable tr').click( function() {
          $(this).toggleClass('rselect');
        });
      $('.SNPtable').dataTable();
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
      var posStr = pos.chrom + ":" + pos.starts + ".." + pos.ends;

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
        if ((idx+1) % 60 === 0) {base += "\n";}
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
      if (_.size(node.children) === 0) {return true;}
      return false;
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

    var menuView = new MenuView({
      el: $("#menu"),
      model: dataModel
    });

    var navigateView = new NavigateView({
      el: $("#navi"),
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

}(jQuery, Backbone, window, _, io, clusterfck, BlobBuilder, location, d3,
  saveAs, document, localStorage));

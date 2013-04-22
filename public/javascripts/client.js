(function ($, Backbone, window, _, io, clusterfck, BlobBuilder, location, d3,
          saveAs, document, localStorage, Option) {
  'use strict';
  // all vars
  var AppRouter, OptionsDialog, ChoiceView, FilterDialog, MenuView, NavigateView,
      HighlightSNPsDialog, MarkAccessionsDialog;
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
  OptionsDialog = Backbone.View.extend({
    initialize: function() {
      _.bindAll(this, "render", "open","setFilterAttrs","setTreeVisibility",
               "setRangeLimit", "onSaveOptions", "loadOptionsFromStorage");
      this.render();
    },

    optionsSet: false,

    render: function() {
      $(document).on("click", "#saveOptions",
                     this.onSaveOptions);

      this.loadOptionsFromStorage();
    },

    loadOptionsFromStorage: function(){
      // load options from local storage (if available)

      // load filter attributes
      var attrs_string = localStorage.getItem("filterAttrs");
      if (attrs_string !== null) {
        var saved_attrs = attrs_string.split(",");

        // remove ones that are not available
        // var attrs = _.keys(this.model.getDisplaySNPs()[0].attributes);
        // attrs = _.without(attrs, 'included', 'ID');
        // var filterAttrs = _.intersection(saved_attrs, attrs);

        // set them in the model
        // this.model.set("filterAttrs", filterAttrs);
        this.model.set({"filterAttrs": saved_attrs});
      }

      // load rangeLimit and treeOn and set in model if valid
      var rangeLimit_string = localStorage.getItem("rangeLimit");
      if (rangeLimit_string !== null) {
        var rangeLimit = parseInt(rangeLimit_string, 10);
        this.model.set({"rangeLimit": rangeLimit});
      }
      var treeOn_string = localStorage.getItem("treeOn");
      if (treeOn_string !== null) {
        var treeOn = treeOn_string == "true" ? true : false;

        this.model.set({"treeOn": treeOn});
      } else {
        this.model.set({"treeOn": true});
      }

      this.optionsSet = true;
    },

    open: function() {
      this.optionsDialog = $('#optionsDialog').dialog({
          title: "Options",
          minWidth: 500,
          zIndex: 90000
        });

      // load options from storage once
      // if (!this.optionsSet) {
      //   this.loadOptionsFromStorage();
      // }
      // clean ald attributes
      $('.attr-form').remove();
      // get access to the form
      var form = $("#attrsList");
      // get feature data
      var attrs = _.keys(this.model.getDisplaySNPs()[0].attributes);
      attrs = _.without(attrs, 'included', 'ID');
      var attrFormHtml = _.reduce(attrs, function(memo, attr) {
         var formLine = "<label class='checkbox attr-form' ";
         formLine += "for='" + attr + "'>" + attr;
         formLine += "<input type='checkbox' name=" + attr + "></label>";
         return memo += formLine;
      }, "");

      form.append(attrFormHtml);

      // set form fields according to dataModel
      var rangeLimit = this.model.get("rangeLimit");
      $("#rangeLimit").val(rangeLimit);
      var treeOn = this.model.get("treeOn");
      if (treeOn) {
        $('input[name=treeOn]').attr('checked', true);
      } else {$('input[name=treeOn]').attr('checked', false);}
      var filterAttrs = this.model.get("filterAttrs");
      _.each(filterAttrs, function(attr) {
        var queryString = "input[name='" + attr + "']";
        $(queryString).attr('checked', true);
      });
    },

    setFilterAttrs: function() {
      // get list of checked attributes
      var checked = [];
      $("#attrsList input:checked").each(
        function (index,item) {
          checked.push(item.name);
        });
      // set them in the model
      this.model.set({"filterAttrs": checked});

      // save it also to local storage
      localStorage.setItem("filterAttrs", checked);
    },

    setTreeVisibility: function() {
      var checked = $("#treeCheckbox input:checked");
      var treeOn;
      if (checked.length > 0) {
        treeOn = true;
      } else {treeOn = false;}
      this.model.set({"treeOn": treeOn});

      // save it also to local storage
      localStorage.setItem("treeOn", treeOn);
    },

    setRangeLimit: function() {
      var rangeLimit = $("#rangeLimit").val();
      this.model.set({"rangeLimit": rangeLimit});

      // save it also to local storage
      localStorage.setItem("rangeLimit", rangeLimit);
    },

    onSaveOptions: function() {
      this.setRangeLimit();
      this.setTreeVisibility();
      this.setFilterAttrs();
    }
  });

  FilterDialog = Backbone.View.extend({
   initialize: function() {
     _.bindAll(this, "render", "open", "drawTable", "onExcludeSelected",
               "onIncludeSelected", "onSelectAll", "onToggleSelection");
     this.render();
   },

   render: function() {
      $(document).on("click", "#filterDialog .exclude-selected",
                      this.onExcludeSelected);
      $(document).on("click", "#filterDialog .include-selected",
                      this.onIncludeSelected);
      $(document).on("click", "#filterDialog .select-all",
                      this.onSelectAll);
      $(document).on("click", "#filterDialog .toggle-selection",
                      this.onToggleSelection);
   },

   open: function() {
     this.filterDialog = $("#filterDialog").dialog({
       title: "Filter input data",
       minWidth: 700,
      zIndex: 90000
     });

     var drawTable = this.drawTable;
     this.model.on("change:pos", function () {
       if ( $("#filterDialog").dialog("isOpen") === true) {
         drawTable();
       }
     });
     this.drawTable();
   },

   onExcludeSelected: function() {
      // get IDs of selected SNPs
      var dTable = this.dTable;
      var excluded = [];
      this.dTable.$(".rselect").each(
        function() {excluded.push(dTable.fnGetData(this, 0));}
      );
     // annotate excluded SNPs
      var SNPs = this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if (_.include(excluded, snp.attributes.ID)) {
          snp.attributes.included = false;
        }
        return snp;
      });

      // update model
      this.model.setDisplaySNPs(SNPs);
      this.drawTable();

      this.model.updateDisplayData();
    },

    onIncludeSelected: function() {
      var dTable = this.dTable;
      var included = [];
      this.dTable.$(".rselect").each(
        function() {included.push(dTable.fnGetData(this, 0));}
      );
      // annotate excluded SNPs
      var SNPs = this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if (_.include(included, snp.attributes.ID)) {
          snp.attributes.included = true;
        }
        return snp;
      });
      // update model
      this.model.setDisplaySNPs(SNPs);
      this.drawTable();

      this.model.updateDisplayData();
    },

    onSelectAll: function() {
      var rows = this.dTable.$('tr', {"filter": "applied"});
      $(rows).addClass('rselect');
    },

    onToggleSelection: function() {
      var rows = this.dTable.$('tr');
      $(rows).toggleClass('rselect');
    },

    drawTable: function() {
      // $("#filterDialog .dataTables_wrapper").remove();
      // fetch SNP data and prepare a table
      var SNPs = this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if (snp.attributes.included === undefined) {
          snp.attributes.included = true;
        }
        return snp;
      });

      $(this.filterDialog).find("p:first")
      .html("<table class='filterTable'></table>");

      // fetch columns chosen in settings
      var attrs = this.model.get("filterAttrs");
      // put all column names in one array
      var colNames = ["ID", "Chrom", "Pos", "Score", "included"];
      _.each(attrs, function(attr) {
         colNames.push(attr);
      });
      // create table header
      var columns = [];
      _.each(colNames, function(name) {
        columns.push({"sTitle": name});
      });
      this.dTable = $('.filterTable').dataTable({
        "bJQueryUI": true,
        "sPaginationType": "full_numbers",
        "oLanguage": {"sSearch": "Search all columns:"},
        "aoColumns": columns});
      // input data into a table
      var data = [];
      _.each(SNPs, function(snp) {
        var includedString = "";

        if (snp.attributes.included) {
          includedString = "<span class=included-row>";
          includedString += snp.attributes.included;
          includedString += "</span>";
        }
        else {
          includedString = "<span class=excluded-row>";
          includedString += snp.attributes.included;
          includedString += "</span>";
        }
        var location;
        if (snp.attributes.variant_location === undefined) {
          location = "unknown";
        }
        else {
          location = snp.attributes.variant_location || "unknown";
        }
        var row = [
          snp.attributes.ID,
          snp.seqid,
          snp.start,
          snp.score,
          includedString
        ];
        _.each(attrs, function(attr) {
          row.push(snp.attributes[attr]);
        });
        data.push(row);
      }, this);

      this.dTable.fnAddData(data);
      // whn a row is clicked select/unselect it
      this.dTable.$('tr').click( function() {
        $(this).toggleClass('rselect');
      });

      // append search boxes in table footer
      var tfoot = "<tfoot><tr>";
      _.each(colNames, function(name) {
        tfoot += "<th rowspan='1' colspan='1'>";
        tfoot += "<input type='text' name='" + name + "' ";
        tfoot += "value='Search " + name + "' class='search_init input-small'>";
        tfoot += "</th>";
      });
      tfoot += "</tr><tfoot>";
      this.dTable.append(tfoot);
      var table = this.dTable;

      // activate filtering with regexp
      $("tfoot input").keyup(function() {
        table.fnFilter(this.value, $("tfoot input").index(this), true);
      });
      var asInitVals = [];
      $("tfoot input").each(function(i) {
        asInitVals[i] = this.value;
      });
      $("tfoot input").focus(function() {
        $(this).toggleClass("search_init");
        this.value = "";
      });
      $("tfoot input").blur(function (i) {
        $(this).toggleClass("search_init");
        this.value = asInitVals[$("tfoot input").index(this)];
      });
    }
  });

  HighlightSNPsDialog = Backbone.View.extend({
    initialize: function() {
      _.bindAll(this, "render", "open", "onHighlightSelected", "onSelectAll",
        "onToggleSelection", "onUnHighlightSelected", "drawTable", "onClose");
      this.render();
    },

    render: function() {
      $(document).on("click", "#highlightSNPsDialog .highlight-selected",
        this.onHighlightSelected);
      $(document).on("click", "#highlightSNPsDialog .unhighlight-selected",
        this.onUnHighlightSelected);
      $(document).on("click", "#highlightSNPsDialog .select-all",
        this.onSelectAll);
      $(document).on("click", "#highlightSNPsDialog .toggle-selection",
        this.onToggleSelection);
    },

    drawTable: function() {
      var SNPs = this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if (snp.attributes.highlighted === undefined) {
          snp.attributes.highlighted = false;
        }
        if (snp.attributes.included === undefined) {
          snp.attributes.included = true;
        }
        return snp;
      });

      this.model.setDisplaySNPs(SNPs);
      this.model.updateDisplayData();

      SNPs = _.map(SNPs, function(snp) {
        if (snp.attributes.included === undefined) {
          snp.attributes.included = true;
        }
        return snp;
      });

      $(this.highlightSNPsDialog).find("p:first")
      .html("<table class='highlightSNPsTable'></table>");
      // fetch columns chosen in settings
      var attrs = this.model.get("filterAttrs");
      // put all column names in one array
      var colNames = ["ID", "Chrom", "Pos", "Score", "highlighted"];
      _.each(attrs, function(attr) {
         colNames.push(attr);
      });

      // create table header
      var columns = [];
      _.each(colNames, function(name) {
        columns.push({"sTitle": name});
      });
      this.dTable = $('.highlightSNPsTable').dataTable({
        "bJQueryUI": true,
        "sPaginationType": "full_numbers",
        "oLanguage": {"sSearch": "Search all columns:"},
        "aoColumns": columns});
      // input data into a table

      var data = [];
      _.each(SNPs, function(snp) {
        var highlightedString = "";
        if (snp.attributes.highlighted) {
          highlightedString = "<span class=highlighted-row>";
          highlightedString += snp.attributes.highlighted;
          highlightedString += "</span>";
        } else {
          highlightedString = "<span class=unHighlighted-row>";
          highlightedString += snp.attributes.highlighted;
          highlightedString += "</span>";
        }

        var location;
        if (snp.attributes.variant_location === undefined) {
          location = "unknown";
        }
        else {
          location = snp.attributes.variant_location || "unknown";
        }

          var row = [
          snp.attributes.ID,
          snp.seqid,
          snp.start,
          snp.score,
          highlightedString
        ];
        _.each(attrs, function(attr) {
          row.push(snp.attributes[attr]);
        });
        data.push(row);
      }, this);

      this.dTable.fnClearTable();
      this.dTable.fnAddData(data);
      this.dTable.$('tr').click( function() {
        $(this).toggleClass('rselect');
      });

    },

    onClose: function() {
      var bufferData = this.model.get("bufferData");
      var SNPs = bufferData.SNPs;
      SNPs = _.map(SNPs, function(snp) {
        snp.attributes.highlighted = undefined;
        return snp;
      });
      bufferData.SNPs = SNPs;
      this.model.set("bufferData", bufferData);
      this.model.updateDisplayData();
    },

    open: function() {
      this.highlightSNPsDialog = $("#highlightSNPsDialog").dialog({
        title: "Highlight SNPs",
        minWidth: 700,
        zIndex: 90000,
        close: this.onClose
      });

      var drawTable = this.drawTable;
      this.model.on("change:pos", function() {
        if( $('#highlightSNPsDialog').dialog("isOpen") === true) {
          drawTable();
        }
      }); 
     this.drawTable();
    },

    onHighlightSelected: function() {
      var dTable = this.dTable;
      var highlighted = [];
      this.dTable.$('.rselect').each(
        function() { highlighted.push(dTable.fnGetData(this, 0));}
      );
      var SNPs= this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if(_.include(highlighted, snp.attributes.ID)) {
          snp.attributes.highlighted = true;
        }
        return snp;
      });
      this.model.setDisplaySNPs(SNPs);
      this.drawTable();
      this.model.updateDisplayData();
    },

    onUnHighlightSelected: function() {
      var dTable = this.dTable;
      var unHighlighted = [];
      this.dTable.$(".rselect").each(
        function() {unHighlighted.push(dTable.fnGetData(this, 0));}
      );
      var SNPs= this.model.getDisplaySNPs();
      SNPs = _.map(SNPs, function(snp) {
        if (_.include(unHighlighted, snp.attributes.ID)) {
          snp.attributes.highlighted = false;
        }
        return snp;
      });
      this.model.setDisplaySNPs(SNPs);
      this.drawTable();
      this.model.updateDisplayData();
    },

    onSelectAll: function() {
      var rows = this.dTable.$('tr', {"filter": "applied"});
      $(rows).addClass('rselect');
    },

    onToggleSelection: function() {
      var rows = this.dTable.$('tr');
      $(rows).toggleClass('rselect');
    },

    // upTable: function() {
    //   var SNPs = this.model.getDisplaySNPs();
    //   SNPs = _.map(SNPs, function(snp) {
    //     if (snp.attributes.highlighted === undefined) {
    //       snp.attributes.highlighted = false;
    //     }
    //     if (snp.attributes.included === undefined) {
    //       snp.attributes.included = true;
    //     }
    //     return snp;
    //   });

    //   this.model.setDisplaySNPs(SNPs);
    //   this.model.updateDisplayData();

    //   SNPs = _.filter(SNPs, function(snp) {
    //     return snp.attributes.included;
    //   });

    //   $(this.highlightSNPsDialog).find("p:first")
    //     .html("<table class='highlightSNPsTable'></table>");

    //   this.dTable = $(".highlightSNPsTable").dataTable({
    //     "bJQueryUI": true,
    //     "sPaginationType": "full_numbers",
    //     "aoColumns": [
    //       {"sTitle": "ID"},
    //       {"sTitle": "Change"},
    //       {"sTitle": "Chrom"},
    //       {"sTitle": "Pos"},
    //       {"sTitle": "Score"},
    //       {"sTitle": "Accession"},
    //       {"sTitle": "Location"},
    //       {"sTitle": "highlighted"}
    //     ]
    //   });

    //   var data = [];
    //   _.each(SNPs, function(snp) {
    //     var highlightedString = "";
    //     if (snp.attributes.highlighted) {
    //       highlightedString = "<span class=highlighted-row>";
    //       highlightedString += snp.attributes.highlighted;
    //       highlightedString += "</span>";
    //     } else {
    //       highlightedString = "<span class=unHighlighted-row>";
    //       highlightedString += snp.attributes.highlighted;
    //       highlightedString += "</span>";}

    //     var location;
    //     if (snp.attributes.variant_location === undefined) {
    //       location = "unknown";
    //     }
    //     else {
    //       location = snp.attributes.variant_location || "unknown";
    //     }

    //     var row = [
    //      snp.attributes.ID,
    //      snp.attributes.Change,
    //      snp.seqid,
    //      snp.start,
    //      snp.score,
    //      snp.attributes.Strain,
    //      location,
    //      highlightedString
    //     ];
    //     data.push(row);
    //   }, this);

    //   this.dTable.fnAddData(data);
    //   this.dTable.$('tr').click( function() {
    //     $(this).toggleClass('rselect');
    //   });
    // }
  });

  MarkAccessionsDialog = Backbone.View.extend({
    initialize: function() {
      _.bindAll(this, "render", "open", "onMarkSelected", "onSelectAll",
      "onToggleSelection", "onUnmarkSelected", "drawTable");
      this.render();
    },

    render: function() {
      $(document).on("click", "#markAccessionsDialog .mark-selected",
      this.onMarkSelected);
      $(document).on("click", "#markAccessionsDialog .unmark-selected",
      this.onUnmarkSelected);
      $(document).on("click", "#markAccessionsDialog .select-all",
      this.onSelectAll);
      $(document).on("click", "#markAccessionsDialog .toggle-selection",
      this.onToggleSelection);
    },

    open: function() {
      this.markAccessionsDialog = $("#markAccessionsDialog").dialog({
        title: "Mark Accessions",
        minWidth: 700,
        zIndex: 90000
      });
      this.drawTable();
    },

    onMarkSelected: function() {
      var dTable = this.dTable;
      var selected = [];
      this.dTable.$('.rselect').each(
        function() { selected.push(dTable.fnGetData(this, 0));}
      );
      var displayData = this.model.get("displayData");
      displayData.markedAccessions = selected;
      this.model.set("displayData", displayData);
      this.drawTable();
      this.model.updateDisplayData();
    },

    onUnmarkSelected: function() {
      var dTable = this.dTable;
      var selected = [];
      this.dTable.$('.rselect').each(
        function() { selected.push(dTable.fnGetData(this, 0));}
      );
      var displayData = this.model.get("displayData");
      var markedAccessions = displayData.markedAccessions;
      markedAccessions = _.difference(markedAccessions, selected);
      displayData.markedAccessions = markedAccessions;
      this.model.set("displayData", displayData);
      this.drawTable();
      this.model.updateDisplayData();
    },

    onSelectAll: function() {
      var rows = this.dTable.$('tr', {"filter": "applied"});
      $(rows).addClass('rselect');
    },

    onToggleSelection: function() {
      var rows = this.dTable.$('tr');
      $(rows).toggleClass('rselect');
    },

    drawTable: function() {
      $("#markAccessionsDialog .dataTables_wrapper").remove();
      var markedAccessions = this.model.get("displayData").markedAccessions;
      var allAccessions = this.model.get("strains");
      $(this.markAccessionsDialog).find("p:first")
      .html("<table class='accessionsTable'></table>");

      this.dTable = $(".accessionsTable").dataTable({
        "bJQueryUI": true,
        "sPaginationType": "full_numbers",
        "aoColumns": [
          {"sTitle": "Accession"},
          {"sTitle": "marked"}
        ]
      });

      _.each(allAccessions, function(accession) {
        var highlightedString = "";
        var isMarked = _.include(markedAccessions, accession);
        if (isMarked) {
          highlightedString = "<span class=highlighted-row>";
          highlightedString += isMarked;
          highlightedString += "</span>";
        } else {
          highlightedString = "<span class=unHighlighted-row>";
          highlightedString += isMarked;
          highlightedString += "</span>";}
          var row = [
            accession,
            highlightedString
          ];
          this.dTable.fnAddData(row);
      }, this);
      this.dTable.$('tr').click( function() {
        $(this).toggleClass('rselect');
      });
    }
  });


  MenuView = Backbone.View.extend({
    initialize: function () {
      _.bindAll(this, "render", "setLocation",
               "openGoToFeatureDialog", "go", "findFeature", "openFilterDialog",
               "openHighlightSNPsDialog", "openMarkAccessionsDialog",
               "onAddBookmark", "onSaveBookmark", "loadBookmarks", "onGenomeChange",
               "onChromChange", "setChromInfo", "updateGenomeOptions",
               "updateChromosomeOptions", "onStartChange", "onEndChange");

      this.model.on("change:pos", this.setLocation);
      this.render();
    },

    render: function () {
      // create dialogs
      this.optionsDialog = new OptionsDialog({
        el: $('#optionsDialog'),
        model: this.model
      });

      this.filterDialog = new FilterDialog({
        el: $("#filterDialog"),
        model: this.model
      });

      this.highlightSNPsDialog = new HighlightSNPsDialog({
        el: $("#highlightSNPsDialog"),
        model: this.model
      });

      this.markAccessionsDialog = new MarkAccessionsDialog({
        el: $("#markAccessionsDialog"),
        model: this.model
      });
      // change chromosome list on genome change
      $(document).on('change', '#loc-genome', this.onGenomeChange);
      // change chromosome sizes on genome or chromosome change
      $(document).on('change', '#loc-chrom', this.onChromChange);
      $(document).on('change', '#loc-genome', this.onChromChange);
      $(document).on('change', '#loc-start', this.onStartChange);
      $(document).on('change', '#loc-end', this.onEndChange);
      // bind action to save bookmark button
      $(document).on("click", "#saveBookmark", this.onSaveBookmark);
      // bind action to Search button in goToFeature popover
      $(document).on("click", "#findFeature", this.findFeature);

      // activate dropdowns
      $(".dropdown-toggle").dropdown();

      // $(window).scroll(function () {
      //   $('#mobile-menu-plus').css({'position': 'fixed', 'z-index': 2,
      //     'top': 0, 'left': 0, 'right': 0});
      // });


      this.loadBookmarks();
      $(document).on("click", ".delbookmark", function(evnt) {
        var name = $(this).closest('li').text();
        localStorage.removeItem("bookmark." + name);
        evnt.preventDefault();
        $(this).closest('li').remove();
      });

      // get chrominfo from model when it changes
      this.model.on('change:chromInfo', this.setChromInfo);
    },

    events: {
      "click #go": "go",
      "click #goToFeature": "openGoToFeatureDialog",
      "click #options": "openOptionsDialog",
      "click #filter": "openFilterDialog",
      "click #highlightSNPs": "openHighlightSNPsDialog",
      "click #markAccessions": "openMarkAccessionsDialog",
      "click #addBookmark": "onAddBookmark"
    },

    updateGenomeOptions: function() {
      // get list of genomes in chromInfo
      var genomeList = _.keys(this.chromInfo);
      // clear genome list
      $('#loc-genome option').remove();
      // get access to options
      var genomeOptions = $("#loc-genome").prop('options');
      // update them
      _.each(genomeList, function(genomeName) {
        genomeOptions[genomeOptions.length] = new Option(genomeName, genomeName);
      });
    },

    updateChromosomeOptions: function() {
      // get position
      var pos = this.model.get('pos');
      var chromList = _.keys(this.chromInfo[pos.genome]).sort();

      // remove existing chromosome options
      $('#loc-chrom option').remove();

      // set chroms as options for #loc-chrom select
      var chromOptions = $('#loc-chrom').prop('options');
      _.each(chromList, function(chromName) {
        chromOptions[chromOptions.length] = new Option(chromName, chromName);
      });
    },

    setChromInfo: function() {
      var pos = this.model.get('pos');
      this.chromInfo = this.model.get('chromInfo');
      // fill in genome options with data from chromIfo
      this.updateGenomeOptions();
      // set the genome
      $('#loc-genome').val(pos.genome);
      // fill in chromosme options with data from chromIfo
      this.updateChromosomeOptions();
      // set the chromosome
      $('#loc-chrom').val(pos.chrom);
      // set starts and ends
      $('#loc-start').val(pos.starts);
      $('#loc-endA').val(pos.ends);
    },

    loadBookmarks: function() {
      var nStored = localStorage.length;
      var i;
      for (i=0; i<nStored; i++) {
        var key = localStorage.key(i);
        if (key.indexOf('bookmark.') >= 0) {
          var name = key.split('bookmark.')[1];
          var href = localStorage.getItem(key);
          var bookmark = "<li><a class='bookmark' href='" + href + "'>";
          bookmark += name + "<i class='icon-trash delbookmark pull-right'>";
          bookmark += "</i></a></li>";
          $("#bookmarkList").append(bookmark);
        }
      }
    },

    onGenomeChange: function(evt) {
      this.updateChromosomeOptions();
      // select first chromosome on the list
      $('#loc-chrom').prop('selectedIndex', 0);
      // triger start and end to change accordingly
    },

    onChromChange: function() {
      // get chosen genome and chromosome
      var genome = $('#loc-genome').val();
      var chrom = $('#loc-chrom').val();
      // get size of chromosome in this genome
      var chroms = this.chromInfo[genome];
      var size = chroms[chrom];
      // set limits on start and end input
      $('#loc-start').prop('max', size);
      $('#loc-end').prop('max', size);
    },

    onStartChange: function(){
     // when start changes set minimal end value as start value
     var start = $('#loc-start').val();
     $('#loc-end').prop('min', start);
    },

    onEndChange: function(){
     // this is not implemented yet, have to think about it
    },


    setLocation: function() {
      var pos = this.model.get('pos');
      $('#loc-chromosome').val(pos.chrom);
      $('#loc-start').val(pos.starts);
      $('#loc-end').val(pos.ends);
    },

    findFeature: function() {
      var genome = $("#feature-genome").val();
      var name = $("#feature-name").val();
      var flanks = parseInt($("#feature-flanks").val(), 10);
      this.model.goToFeature(genome, name, flanks);
    },

    openOptionsDialog: function() {
      this.optionsDialog.open();
    },

    openGoToFeatureDialog: function() {
      $("#goToFeatureDialog").dialog({
          title: "Find feature of interest.",
          zIndex: 90000
        });
    },

    openMarkAccessionsDialog: function() {
      this.markAccessionsDialog.open();
    },

    go: function() {
      var pos = {};
      pos.genome = $("#loc-genome").val();
      pos.chrom =  $("#loc-chrom").val();
      pos.starts =  parseInt($("#loc-start").val(), 10);
      pos.ends = parseInt($("#loc-end").val(), 10);
      this.model.set({"pos": pos});
    },

    openFilterDialog: function () {
      this.filterDialog.open();
    },

    openHighlightSNPsDialog: function() {
      this.highlightSNPsDialog.open();
    },

    onAddBookmark: function() {
      this.bookmarkDialog = $("#bookmarkDialog").dialog({
        title: "Save position",
        zIndex: 90000
      });
    },

    onSaveBookmark: function() {
      var name = $("#bookmarkName").val();
      var href = window.location.href;
      var bookmark = "";
      bookmark = "<li><a class='bookmark' href=" + href + ">";
      bookmark += name + "<i class='icon-trash delbookmark pull-right'>";
      bookmark += "</i></a></li>";
      $("#bookmarkList").append(bookmark);
      this.bookmarkDialog.dialog("close");
      localStorage.setItem('bookmark.' + name, href);
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
      var pos = this.model.get("pos"),
          step = Math.floor((pos.ends - pos.starts) / this.step),
          starts = pos.starts - step,
          ends = pos.ends - step,
          update = {
            pos: {
              "genome": pos.genome,
              "starts": starts,
              "ends": ends,
              "chrom": pos.chrom
            }
          };

      starts = starts > 0 ? starts : 0;
      this.model.set(update);
    },

    zoomOut: function() {
      var pos = this.model.get("pos"),
          step = Math.floor((pos.ends - pos.starts) / 2),
          starts = pos.starts - step,
          ends = pos.ends + step,
          update = {
            pos: {
              "genome": pos.genome,
              "starts": starts,
              "ends": ends,
              "chrom": pos.chrom
            }
          };
      starts = starts > 0 ? starts : 0;
      this.model.set(update);
    },

    zoomIn: function() {
      var pos = this.model.get("pos"),
          step = Math.floor((pos.ends - pos.starts) / 4),
          starts = pos.starts + step,
          ends = pos.ends - step,
          update = {
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
      var pos = this.model.get("pos"),
          step = Math.floor((pos.ends - pos.starts) / this.step),
          starts = pos.starts + step,
          ends = pos.ends + step,
          update = {
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
        "ends": 0
      },
      "strains": [],
      "filterAttrs": [],
      "treeOn": true,
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
        markedAccessions: []
      }
    },

    initialize: function() {
      _.bindAll(this, "updatePosition", "updateDisplayData",
        "waitForData", "updateBufferData", "importData",
        "isLocusInRegion", "isFeatureInRegion", "calcHaplotypes",
      "goToFeature", "goToFeatureRegion",  "cluster", "importStrains",
      "getStrains", 'reloadData', 'savePosition', "loadLocation",
      "getDisplaySNPs", "setDisplaySNPs", "getChromInfo", "onChromInfo",
      "positionIsAvailable", "setStartingPosition");

      var appAddress = 'http://' + $('#hostip').val();
      this.set({socket: io.connect(appAddress)});

      // when data come back
      this.get("socket").on("data", this.importData);
      this.get("socket").on("featureRegion", this.goToFeatureRegion);
      this.get("socket").on("geneModels", this.importData);
      this.get("socket").on("strains", this.importStrains);
      this.get("socket").on("chromInfo", this.onChromInfo);

      // ask db for information about chromosomes
      this.getChromInfo();

      // update the model when position chnages
      this.on("change:pos", function() {
        this.updatePosition();
        this.savePosition();
      });
    },

    getChromInfo: function() {
      var socket = this.get("socket");
      socket.emit("getChromInfo");
    },

    onChromInfo: function(chromInfoObject) {
      // get chromInfo
      // and reshape it into more userefriedly structure
      var chromInfo= _.reduce(chromInfoObject, function(memo, gen) {
        memo[gen.genome] = gen.chromosomes;
        return memo;
      }, {});
      // check if there is already set position
      // (this might be the case if it's been set by routing)
      var pos = this.get("pos");
      if (!this.positionIsAvailable(pos, chromInfo)) {
        // if this is not a valid position
        // try to get it from local storage
        pos = this.loadLocation();
      }
      if (pos && this.positionIsAvailable(pos, chromInfo)) {
        // set this loaded postion
        this.set({"pos": pos});
      }
      else {
        this.setStartingPosition(chromInfo);
      }
      this.set('chromInfo', chromInfo);
      // load old location from local storage
      this.loadLocation();
      this.updateBufferData();
      this.getStrains();
    },

    getDisplaySNPs: function(){
      return this.get("displayData").SNPs;
    },

    setDisplaySNPs: function(snps) {
      var displayData = this.get("displayData");
      displayData.SNPs = snps;
      this.set("displayData", displayData);
    },

    loadLocation: function() {
      // load loacation from local storage
      var pos = {};
      pos.genome = localStorage.getItem("genome");
      if (! pos.genome) {
        return null;
      }
      pos.chrom = localStorage.getItem("chrom");
      pos.starts = parseInt(localStorage.getItem("starts"), 10);
      pos.ends = parseInt(localStorage.getItem("ends"), 10);
      return(pos);
    },

    positionIsAvailable: function(pos, chromInfo) {
      var posAvailable = true;
      var genomes = _.keys(chromInfo);
      if ($.inArray(pos.genome, genomes) === -1) {
        posAvailable = false;
      }
      else {
        var chromosomes = _.keys(chromInfo[pos.genome]);
        if ($.inArray(pos.chrom, chromosomes) === -1){
          posAvailable = false;
        }
        else {
          var size = chromosomes[pos.chrom];
          if ((pos.starts > size) || (pos.ends > size)){
            posAvailable = false;
          }
        }
      }
      return(posAvailable);
    },

    setStartingPosition: function(chromInfo) {
      var pos = {};
      pos.genome = _.keys(chromInfo)[0];
      pos.chrom = _.keys(chromInfo[pos.genome]).sort()[0];
      pos.ends = 5000;
      pos.starts = 1;
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
      var startInBuffer = pos.starts >= bufferData.starts,
          endInBuffer = pos.ends <= bufferData.ends;
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
      var bufferData = this.get("bufferData"),
          // fetch the fragment from the buffer
          displayData = this.get("displayData"),
          // get features
          features = bufferData.features;
      displayData.features = _.select(features, this.isFeatureInRegion);

      // if range exceeded save just features and return
      if (this.get("rangeExceeded")) {
        // set obtained data to the model
        this.set({"displayData": displayData});
        this.trigger("change:displayData:clusters");
        return;
      }

      // get SNPs in region
      var SNPs = bufferData.SNPs;
      var pos = this.get("pos");
      displayData.SNPs = _.select(SNPs, function(snp) {
        return ((snp.start >= pos.starts) && (snp.start <= pos.ends));
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
      var SNPs = _.select(displayData.SNPs, function(snp) {
        return (snp.attributes.included || snp.attributes.included === undefined);
      });

      // if there are no snps do nothing
      if (SNPs.length < 1) {
        displayData.haplotypes = {};
        this.set({"displayData": displayData});
        return;
      }

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
      _.bindAll(this, "render", "draw", "drawTraits", "drawGeneModels",
                "drawHaplotpes", "drawScaleBars", "drawTree",
                "turnOffHaplotypes", "isLeaf", "leaf2haplotype",
                "turnOnHaplotypes", "onSNPmouseOver", "onSNPmouseOut",
                "onSNPClick", "onHaplCLick", "drawLegend", "unHighlightSNPs",
                "markHaplotypes", "toggleTree");

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
      this.model.on('change:treeOn', this.toggleTree);
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
      // check if treeOn or not
      var treeOn = this.model.get("treeOn");
      $("#tree").css("width", winWidth/2 - this.padding);
      $("#chart").css("width", this.width/2 - this.padding);

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


      if (!this.model.get("treeOn")) {
        this.toggleTree();
      }
      return this;
    },

    toggleTree: function() {
      var winWidth = $(window).width();
      var newWidth = winWidth - this.padding;
      $("#tree").toggle();
      if ($("#tree").is(":visible")) {
        this.width = winWidth/2 - this.left - this.right - this.padding;
        $("#chart").css("width", this.width/2 - this.padding);
      } else {
        this.width = winWidth;
        $("#chart").css("width", this.width);
        d3.select(".chart").attr("width", newWidth);
      }

      this.model.updatePosition();
    },

    unHighlightSNPs: function() {
      var snps = this.model.get('displayData').SNPs;

      var highlighted = _.filter(snps, function(snp) {
        return snp.attributes.highlighted;
      });
      var unhighlighted = _.filter(snps, function(snp){
        return snp.attributes.highlighted === false;
      });

      highlighted = _.reduce(highlighted, function(memo, snp) {
        var posStrains = memo[snp.start] || [];
        posStrains.push(snp.attributes.Strain);
        memo[snp.start] = posStrains;
        return memo;
      }, {});

      unhighlighted = _.reduce(unhighlighted, function(memo, snp) {
        var posStrains = memo[snp.start] || [];
        posStrains.push(snp.attributes.Strain);
        memo[snp.start] = posStrains;
        return memo;
      }, {});

      var SNPCir = this.svg.selectAll('.SNP')
      .transition().duration(200)
      .style("opacity", function(d) {
        var highlightedPositions = _.keys(highlighted);
        var isInHighlightedPosition = _.include(highlightedPositions,
                                                String(d.x));
        if (isInHighlightedPosition) {
          var highlightedStrains = highlighted[String(d.x)];
          if ( (_.intersection(d.strains, highlightedStrains).length > 0) ||
            _.include(d.strains, "refStrain") ){
              return 1;
            }
        }
        var unhighlightedPositions = _.keys(unhighlighted);
        var isInUnhighlightedPosition = _.include(unhighlightedPositions,
                                                  String(d.x));
        if (isInUnhighlightedPosition) {
          var unhighlightedStrains = unhighlighted[String(d.x)];
          if (_.intersection(d.strains, unhighlightedStrains).length > 0) {
              return 0.1;
            }
        }
        return 0.8;
      });
    },

    markHaplotypes: function() {
      var markedAccessions = this.model.get("displayData").markedAccessions;
      var haplotypes = this.svg.selectAll('.hap')
        .transition().duration(200)
        .style("opacity", function(d){
          var haplStrains = d.strains;
          if (_.intersection(markedAccessions, haplStrains).length > 0) {
            return 0.4;
          }
          return(0.2);
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
      // this.svg.selectAll('.message').remove();

      this.drawTraits(displayData);
      this.drawGeneModels(displayData);

      // if there is no snps don't try to cluster and plot haplotypes
      var snps = this.model.get("displayData").SNPs;
      if (snps.length < 1) {
        $("#alerts").show();
      } else {
        $("#alerts").hide();
      }
      this.drawTree();
      this.drawHaplotpes();
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

      // calculate new freePos by calculating the max number
      // of gene models per locus
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
      var haplotypeBars = this.svg.selectAll('.hap, .refHap')
      .attr('width', width)
      .data(this.leaves);
      haplotypeBars
      .attr('y', function(d) { return d.x + freePos - trackH/2;})
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
      .attr('class', this.baseClass);

      SNPCircles.enter().append('svg:circle')
      .attr('class', this.baseClass)
      .attr('r', glyphH/4)
      .attr('cx', function(d) { return x(d.x); })
      .attr('cy', function(d) {
        return d.y + freePos - glyphT;
      })
      .on("mouseover", this.onSNPmouseOver)
      .on("mouseout", this.onSNPmouseOut)
      .on('click', this.onSNPClick);
      SNPCircles.exit().remove();

      this.unHighlightSNPs();
      this.markHaplotypes();

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
          var children = d.children = _.compact([d.left , d.right]);
          return (children);
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
      } else {this.leaves = [];}
    },

    drawLegend: function(){
      var glyphH = this.glyphH;
      var circleData = [
        [glyphH/2, "#ABD9E9", "A"],
        [glyphH*5.5, "#FDAE61", "C"],
        [glyphH*10.5, "#D7191C", "G"],
        [glyphH*15.5, "#2C7BB6", "T"]];

      var rectData = [
        [0, "chartreuse", "gene"],
        [glyphH*5, "slateblue", "5'UTR"],
        [glyphH*10, "teal", "3'UTR"],
        [glyphH*15, "steelblue", "CDS"]];

      var legendCircs = this.svgTree.selectAll('.legendCircs')
        .data(circleData);
      legendCircs.enter().append("svg:circle")
        .attr('class', function(d) {return 'legendCircs ' + d[2];})
        .attr('r', glyphH/4)
        .attr('cx', function(d) {return d[0];})
        .attr('cy', 0);

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
        if (_.include(posWithSNP, d.x)) {return 0.4;}
        return 0;
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
      .style("opacity", 0.4);
      d3.selectAll(".nodeCircle")
      .transition()
      .duration(400)
      .style("fill", "#fff");
    },

    onSNPClick: function(d, i) {
      // open a dialog for dipalying info about the SNP
      var SNPDialog = $('#SNPDialog').clone().dialog({
         title: "Single Nucleotide Polymorphism",
         minWidth: 540,
         zIndex: 90000,
         close: function(ev, ui) {
          $(this).remove();
         }
      });
      // find all SNPs at this position in this haplotype
      var SNPs = _.filter(this.allSNPs, function(snp) {
        return _.include(d.strains, snp.attributes.Strain) && d.x === snp.start;
      });
      // fetch columns chosen in settings
      var attrs = this.model.get("filterAttrs");
      var colNames = ["ID", "Chrom", "Pos", "Score"];
      _.each(attrs, function(attr) {
         colNames.push(attr);
      });
      var columns = [];
      _.each(colNames, function(name) {
        columns.push({"sTitle": name});
      });
      $(SNPDialog).find("p:first")
      .html("<table class='SNPTable'></table>");

      this.dTable = $('.SNPTable').dataTable({
        "bJQueryUI": true,
        "sPaginationType": "full_numbers",
        "oLanguage": {"sSearch": "Search all columns:"},
        "aoColumns": columns});

      var data = [];
      _.each(SNPs, function(snp) {
        var highlightedString = "";
        if (snp.attributes.highlighted) {
          highlightedString = "<span class=highlighted-row>";
          highlightedString += snp.attributes.highlighted;
          highlightedString += "</span>";
        } else {
          highlightedString = "<span class=unHighlighted-row>";
          highlightedString += snp.attributes.highlighted;
          highlightedString += "</span>";
        }

        var location;
        if (snp.attributes.variant_location === undefined) {
          location = "unknown";
        }
        else {
          location = snp.attributes.variant_location || "unknown";
        }

          var row = [
          snp.attributes.ID,
          snp.seqid,
          snp.start,
          snp.score,
        ];
        _.each(attrs, function(attr) {
          row.push(snp.attributes[attr]);
        });
        data.push(row);
      }, this);

      this.dTable.fnClearTable();
      this.dTable.fnAddData(data);
      this.dTable.$('tr').click( function() {
        $(this).toggleClass('rselect');
      });
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
        minWidth: 600,
        zIndex: 90000,
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

    baseClass: function(d) {
      var baseList = ["A", "T", "G", "C"];
      if ( _.contains(baseList, d.base) ) {
        return "SNP " + d.base;}
      else {
        return "SNP IUPAC";}
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
      model: dataModel,
      menuView: menuView
    });

  });

}(jQuery, Backbone, window, _, io, clusterfck, BlobBuilder, location, d3,
  saveAs, document, localStorage, Option));

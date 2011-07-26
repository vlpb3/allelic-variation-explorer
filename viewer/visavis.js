
// translation for vertical bars
var tx = function(d) { return "translate(" + x(d) + ", 0)";};

// translation for features
var tg = function(d) { return "translate("
          + x(d.start) + ", "
          + geneTrackMap[d.attributes.Name] * dim.trackh + dim.trackMargin
          + ")";};
// function determining snp color
var sc = function(d) {
  var base = d.attributes.Change.split(":")[1];
  var snpColor = {
          'A': 'red',
          'C': 'green',
          'G': 'blue',
          'T': 'orange',
        };

  return snpColor[base];
}

// initialize all data

var pos = { // current position in the sequence
  start: 73,
  end: 1000,
  chrom: 'Chr1', // on which chromosome
  max: 0, // mximal position in the sequence
  min: 0 // minimal position in the sequence
};

var features = {};
var strains = {};
var haplotypes = [];
var flatHaplotypes = [];
var geneTracks = [];
var mRNATracks = [];
var geneTrackMap = {};
var mRNATrackMap = {};

// view settings
var dim = {w: 710, h: 0, // width and higth
  nTracks: 0,
  nFeatTracks: 0,
  trackh: 20, // height of tracks
  trackMargin: 5, // distance from one track to bar of next track
  barh: 10, // height og the bar

};

var padding = [20,30,20,40]; // top right bottom left
var stroke = function(d) { return d ? "#eee" : "#fff"; };

// get the range of the sequence
pos.max = getPosMax();
pos.min = getPosMin();

// scale for sequence display
var x = d3.scale.linear().domain([73, 1000])
                        .range([0, dim.w])
                        .nice();

updateData()


var svg = d3.select("#chart").append("svg:svg")
    .attr("width", dim.w + padding[1] + padding[3])
    .attr("height", dim.h + padding[0] + padding[2])
    .attr("pointer-events", "all")
  .append("svg:g")
    .attr("transform", "translate(" + padding[3] + "," + padding[0] + ")")
    .call(d3.behavior.zoom().on("zoom", zoompan));

svg.append("svg:rect")
    .attr("width", dim.w)
    .attr("height", dim.h)
    .attr("stroke", stroke)
    .attr("fill", "none");

redraw();

// moving around -----------------------------------------------
function zoompan(){
  if (d3.event) d3.event.transform(x);

  updateDomain();
}

function jumpToRegion() {
  var start = parseInt(document.forms.region.start.value);
  var end = parseInt(document.forms.region.end.value);
  changeDomain(start, end);

}

function moveLeft() {
  var stepInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch / stepInFrac);
  if (pos.start - step <= pos.min) {
    start = pos.min;
    end = pos.min + stretch;
  } else {
      start = pos.start - step;
      end = pos.end - step;
  }

  changeDomain(start, end);
}

function moveRight() {
  var stepInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch /stepInFrac);
  if (pos.end + step > pos.max) {
    end = pos.max;
    start = pos.max - stretch;
  } else {
    end = pos.end + step;
    start = pos.start + step;
  }
  changeDomain(start, end);
}

function zoomIn() {
  var zoomInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch/(zoomInFrac*2));
  if (stretch > 20) {
    start = pos.start + 4*step;
    end = pos.end - 4*step;
  }
  changeDomain(start, end);
}

function zoomOut() {
  var zoomInFrac = 5;
  var stretch = pos.end - pos.start;
  if ((pos.start - stretch*4) <= pos.min ) {
    start = pos.min;
  } else {
    start = pos.start - stretch*4;
  }
  if ( (pos.end + stretch*4) >= pos.max) {
    end = pos.max;
  } else {
    end = pos.end + stretch*4;
  }
  changeDomain(start, end);
}

function redraw() {
  // stripes for haplotypes

  if (features.SNP) {
  var hs = svg.selectAll(".hstripe")
      .data(d3.range(dim.nFeatTracks, dim.nTracks), String);

  hs.enter().append("svg:rect")
      .attr("class", "hstripe")
      .attr("fill", "lightgrey")
      .attr("stroke-width", 1)
      .attr("stroke", "white")
      .attr("width", dim.w)
      .attr("height", dim.trackh - 1)
      .attr("y", function(d) {return d*dim.trackh});
  hs.exit().remove();
  }

  // gene bars -------------------------------
  svg.selectAll(".geneBar").remove();
  if (features.gene) {
    svg.selectAll(".geneBar")
        .data(features.gene)
      .enter().append("svg:rect")
        .attr("class", "geneBar")
        .attr("fill", "lightblue")
        .attr("width", function(d) { return x(d.end) - x(d.start); } )
        .attr("height", dim.barh)
        .attr("x", function(d) { return x(d.start); } )
        .attr("y", function(d) {
              return geneTrackMap[d.attributes.Name] * dim.trackh
              + dim.trackMargin;
              } );
  }

  // mRNA bars -------------------------------
  svg.selectAll(".mRNABar").remove();
  if (features.mRNA) {
    svg.selectAll(".mRNABar")
        .data(features.mRNA)
      .enter().append("svg:rect")
        .attr("class", "mRNABar")
        .attr("fill", "lightgreen")
        .attr("width", function(d) { return x(d.end) - x(d.start); } )
        .attr("height", dim.barh)
        .attr("x", function(d) { return x(d.start); } )
        .attr("y", function(d) {
              return mRNATrackMap[d.attributes.Name] * dim.trackh
              + dim.trackMargin + geneTracks.length * dim.trackh;
              } );
  }

  // snp tracks --------------------------------
  //svg.selectAll("circle").remove();
  if (features.SNP) {
    var snp = svg.selectAll(".snp")
        .data(flatHaplotypes);
    snp.attr("cx", function(d) {return x(d.start)})
        .attr("fill", sc)
        .attr("cy", function (d) {return dim.trackh/2
        + dim.trackh*(d.iHaplotype + dim.nFeatTracks);
        });

      snp.enter().append("svg:circle")
        .attr("class", "snp")
        .attr("fill", sc)
        .attr("r", 3)
        .attr("cx", function(d) {return x(d.start)} )
        .attr("cy", function (d) {return dim.trackh/2
              + dim.trackh*(d.iHaplotype + dim.nFeatTracks); });
        snp.exit().remove();
  }

 
  // dialogs for snps
    $('.snp_tip').remove();
    $('.snp').hover(
        function(e) {
            var snp_id = "x" + d3.round($(this).attr('cx')) + "y" + d3.round($(this).attr('cy'));
            if ($('#' + snp_id).length ===0) {
                 var $dialog = $('<div></div>')
                    .attr('id', snp_id)
                    .attr('class', 'snp_tip')
                    .html('my pos is' + snp_id)
                    .dialog({
                         autoOpen: false,
                        tiltle: 'Basic Dialog',
                        draggable: true,
                        resizable: true,
                        
                    });
            }
            $('#' + snp_id).dialog({position: [e.pageX + 20, e.pageY - 10]});
            $('#'+ snp_id).dialog('open');   
            return false;
        },
        function(e) {
            var snp_id = "x" + d3.round($(this).attr('cx')) + "y" + d3.round($(this).attr('cy'));
              $('#' + snp_id).dialog('close');
              return false;
      }
  );

  $('.snp').unbind('click').bind('click',   // fix thiss by putting averything
                                            //to $(document).ready(function(){}) 
      function(e) {
          var $dialog = $('<div></div>')
          .html('this was clicked one')
          .dialog({
              autoOpen: false,
              tiltle: 'Basic Dialog',
              draggable: true,
              resizable: true,
              close: $(this).dialog('remove')
          });
            $dialog.dialog({position: [e.pageX + 20, e.pageY - 10]});
            $dialog.dialog('open');
            console.log('dialog');
          return false;
      }
  )

// veritcal bars -----------------------------
  var fx = x.tickFormat(10);

  var gx = svg.selectAll("g.x")
      .data(x.ticks(10), String)
      .attr("transform", tx);

  gx.select("text")
      .text(fx);

  gx.select("line")
      .attr("y1", 0)
      .attr("y2", dim.h);

  var gxe = gx.enter().insert("svg:g", "rect")
      .attr("class", "x")
      .attr("transform", tx);

  gxe.append("svg:line")
      .attr("stroke", stroke)
      .attr("y1", 0)
      .attr("y2", dim.h);

  gxe.append("svg:text")
      .attr("y", 0)
      .attr("dy", "-0.5em")
      .attr("text-anchor", "middle")
      .text(fx);

  gx.exit().remove();

}

function changeDomain(o_start, o_end) {
  var start, end;
  if (o_start < o_end) {start = o_start; end = o_end;}
    else {start = o_end; end = o_start;};

  start = start < pos.min ? pos.min : start;
  end = end > pos.max ? pos.max : end;

  pos.start = start;
  pos.end = end;

  document.forms.region.start.value = start;
  document.forms.region.end.value = end;

  x.domain([start, end]);

  updateData();
  redraw();

}

function updateDomain() {

  // get current range from scale
  var start = d3.round(x.invert(0));
  var end = d3.round(x.invert(dim.w));

  pos.start = start;
  pos.end = end;
  // put values into the form
  document.forms.region.start.value = start;
  document.forms.region.end.value = end;

  // update data
  updateData();
  redraw();
}

// end of moving oround -----------------------------------------

// update data
function updateData() {
  // update feature sequence for new region
  features = getFeatures();
  strains = getStrains();
  haplotypes = getHaplotypes();
  flatHaplotypes = getFlatHaplotypes();
  if ( !(features.gene === undefined) ) {
   geneTracks = splitFeatures(features.gene);
  }
  if ( !(features.mRNA === undefined) ) {
    mRNATracks = splitFeatures(features.mRNA);
  }
  geneTrackMap = trackMapping(geneTracks);
  mRNATrackMap = trackMapping(mRNATracks);
  dim.nTracks = getnTracks();
  dim.nFeatTracks = geneTracks.length + mRNATracks.length;
  dim.h = dim.nTracks * dim.trackh;
}

function getFeatures(){
  var features = {};
  for (var i in seq){
    var feature = seq[i];
    var type;

    if (feature.type.match(/^SNP_.*/)){
      type = "SNP";
    } else {type = feature.type}

    var featurePos = {
      'start': parseInt(feature.start),
      'end': parseInt(feature.end)
      };
    if ( (feature.seqid == pos.chrom)
      && (feature.start <= pos.end)
      && (feature.end >= pos.start) ) {
        if (!features[type]){
          features[type] = [];
        }
        features[type].push(feature);
      }
  }
  return features;
}

function getStrains() {
    var strains = {};
    if (features.SNP !== undefined) {
        for (var s = 0; s < features.SNP.length ; s++){
            var strain = features.SNP[s];
            var name = strain.attributes.Strain.split("=")[1];
            if (!strains[name]) {
                strains[name] = {'seq': [], 'snps': []};
            }
            var base = strain.attributes.Change.split(":")[1];
            strains[name].seq[strain.start] = base;
            strains[name].snps.push(strain);
        }
    }
    return strains;
}

function getHaplotypes() {
  var haploHash = {};
  for (var s in strains){
    var strain = strains[s];
    var seqid = strain.seq.toString();
    if (!haploHash[seqid]){
      haploHash[seqid] = [];
    }
    haploHash[seqid].push(strain);
  }
  var haplotypes = [];
  for (h in haploHash){
    haplotypes.push(haploHash[h]);
  }
  return haplotypes;
}

function getFlatHaplotypes(){
  var flatHaplotypes = []
  for (var h = 0; h < haplotypes.length; h++) {
    for (var s = 0; s < haplotypes[h][0].snps.length; s++){
        var snp = haplotypes[h][0].snps[s];
        snp['iHaplotype'] = parseInt(h);
        flatHaplotypes.push(snp);
    }
  }
  return flatHaplotypes;
}

function getnTracks(){
  return  geneTracks.length + mRNATracks.length + haplotypes.length;
}

function getPosMax() {
  var posMax = 0;
  for (s in seq) {
    var end = parseInt(seq[s].end);
    posMax = end > posMax ? end : posMax;
  }
  return posMax;
}

function getPosMin() {
  var posMin = pos.max;
  for (s in seq) {
    var start = parseInt(seq[s].start);
    posMin = start < posMin ? start : posMin;
  }
  return posMin;
}

// check if provided features overlap
function overlapping(feat1, feat2) {
  return (feat1.start < feat2.end) && (feat1.end > feat2.start) ? true : false;
}

// get features assigned to separate tracks so that they do not overlap
function splitFeatures(featList) {
  // first make an array of arrays (one array per feature in the list)
  var featTracks = [];
  for (var f = 0; f < featList.length; f++) {
    featTracks.push([]);
  }
  for (var f = 0; f < featList.length; f++) {
    for (var tr = 0; tr < featTracks.length; tr++) {
      if (featTracks[tr].length == 0) {
        featTracks[tr].push(featList[f]);
        break;
      } else {
        var overlap = false;
        for (var trel = 0; trel < featTracks[tr].length; trel++) {
          if ( overlapping(featList[f], featTracks[tr][trel]) ) {
            overlap = true;
            break;
          }
        }
        if (overlap) {
          continue;
        } else {
          featTracks[tr].push(featList[f]);
          break;
        }
      }
    }
  }
  // delete empty elements in the array
  for (var tr = 0; tr < featTracks.length; tr++ ) {
    if ( featTracks[tr].length === 0 ) {
      featTracks.splice(tr,1);
      tr--;
    }
  }

  return featTracks;
}

function trackMapping(featureTracks){
  trackMap = {};
  for (var tr in featureTracks) {
    for (var trel in featureTracks[tr]) {
      var id = featureTracks[tr][trel].attributes.Name;
      trackMap[id] = tr;
    }
  }
  return trackMap;
}

$(document).ready(function(){


       });




var tx = function(d) { return "translate(" + x(d) + ", 0)";};


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
var geneTracks = [];
var mRNATracks = [];

// view settings
var dim = {w: 710, h: 0, // width and higth
  nTracks: 0,
  trackh: 10 // number of tracks in view (feature + snp tracks)
};
var padding = [20,30,20,40]; // top right bottom left
var stroke = function(d) { return d ? "#ccc" : "#fff"; };

// get the range of the sequence
pos.max = getPosMax();
pos.min = getPosMin();

// scale for sequence display
var x = d3.scale.linear().domain([pos.start, pos.end])
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

  // get new range
  var start = x.invert(0);
  var end = x.invert(dim.w);

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

function redraw(){

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

  x.domain([pos.start, pos.end]);

  updateData();
  redraw();

}

function updateDomain() {

  // get current range from scale
  var start = d3.round(x.invert(0));
  var end = d3.round(x.invert(dim.h));

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
  geneTracks = splitFeatures(features.gene);
  mRNATracks = splitFeatures(features.mRNA);
  dim.nTracks = getnTracks();
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
  for (var s in features.SNP){
    var strain = features.SNP[s];
    var name = strain.attributes.Strain.split("=")[1];
    if (!strains[name]) {
      strains[name] = {'seq': [], 'snps': []};
    }
    var base = strain.attributes.Change.split(":")[1];
    strains[name].seq[strain.start] = base;
    strains[name].snps.push(strain);
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
  for (var f in featList) {
  featTracks.push([]);
  }
  for (var f in featList) {
    for (var tr in featTracks) {
      if (featTracks[tr].lenght == 0) {
        featTracks[tr].push(featList[f]);
        break;
      } else {
        var overlap = false;
        for (var trel in featTracks[tr]) {
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
  // now delete empty elements in the tracks
  for (var tr in featTracks) {
    if ( featTracks[tr].length == 0 ) {
    delete featTracks[tr];
    }
  }
  return featTracks;
}


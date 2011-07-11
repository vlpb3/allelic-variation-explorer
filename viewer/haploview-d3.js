// get default chromosome, start and end from the form
var pos = {
  'chrom': document.forms.region.chrom.value,
  'start': parseInt(document.forms.region.start.value),
  'end': parseInt(document.forms.region.end.value),
  'min': 0,
  'max': 0
}

var features = {};
var strains = {};
var haplotypes = [];
var geneTracks = [];
var mRNATracks = [];

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

pos.max = getPosMax();

var dim = {
  w: 500,
  trackh: 25,
  barh: 10,
  margin: 25,
  top: 25
};

// update data
function updateData() {
    // update feature sequence for new region
  features = getFeatures();
  strains = getStrains();
  haplotypes = getHaplotypes();
  geneTracks = splitFeatures(features.gene);
  mRNATracks = splitFeatures(features.mRNA);
  dim.nTracks = getnTracks();
  dim.s =  d3.scale.linear().domain([pos.start, pos.end]  ).range([0, dim.w]).nice();
  dim.h = dim.nTracks * dim.trackh;
}

updateData();



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

// calculate how many tracks should fit in the chart
// sum up number of feature tracks, and haplotype tracks





// chart display
var svg = d3.select('#chart')
  .append("svg:svg")
    .attr("width", dim.w + 2*dim.margin)
    .attr("heigth", dim.h)
  .append("svg:g")
    .attr("transform", "translate(" + dim.margin + "," + dim.top + ")");

var seqrules = svg.selectAll("g.seqrules")
        .data(dim.s.ticks(8))
      .enter().append("svg:line")
        .attr("class", "seqrule")
        .attr("y1", 0)
        .attr("y2", dim.h)
        .attr("x1", dim.s)
        .attr("x2", dim.s)
        .attr("stroke", "lightgrey");

var seqtext = svg.selectAll("g.seqtext")
        .data(dim.s.ticks(8))
      .enter().append("svg:text")
        .attr("y", -5)
        .attr("dy", ".0.71em")
        .attr("x", dim.s)
        .attr("text-anchor", "middle")
        .text(dim.s.tickFormat(8));


function move() {

  var seqtext = svg.selectAll('text')
    .data(dim.s.ticks(8));

  seqtext.exit().remove();

  seqtext
      .attr("x", dim.s)
      .text(dim.s.tickFormat(8));

  seqtext.enter()
    .append("svg:text")
    .attr("y", -5)
    .attr("dy", ".0.71em")
    .attr("text-anchor", "middle")
    .attr("x", dim.s)
    .text(dim.s.tickFormat(8));

  var seqrule = svg.selectAll('line')
    .data(dim.s.ticks(8));

  seqrule.exit().remove();

  seqrule
      .attr("x1", dim.s)
      .attr("x2", dim.s);

  seqrule.enter()
    .append("svg:line")
      .attr("class", "seqrule")
      .attr("y1", 0)
      .attr("y2", dim.h)
      .attr("stroke", "lightgrey")
      .attr("x1", dim.s)
      .attr("x2", dim.s);
}

// function run on form submition
function submit() {
  pos.chrom = document.forms.region.chrom.value;
  pos.start = parseInt(document.forms.region.start.value);
  pos.end = parseInt(document.forms.region.end.value);

  updateData();
  move();
}

function moveLeft() {
  var stepInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch / stepInFrac);
  var start = pos.start - step;
  if (start < 1) {
    pos.start = 1;
    pos.end = stretch;
    } else {
      pos.start = start;
      pos.end = pos.end - step;
    }

  updateData();
  move()
}


function moveRight() {
  var stepInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch /stepInFrac);
  if (pos.end + step > pos.max) {
    pos.end = pos.max;
    pos.start = pos.max - stretch;
  } else {
    pos.end = pos.end + step;
    pos.start = pos.start + step;
  }

  updateData();
  move();
}

function zoomIn() {
  var zoomInFrac = 5;
  var stretch = pos.end - pos.start;
  var step = d3.round(stretch/(zoomInFrac*2));
  if (stretch > 20) {
    pos.start = pos.start + 4*step;
    pos.end = pos.end - 4*step;
  }

  updateData();
  move()
}

function zoomOut() {
  var zoomInFrac = 5;
  var stretch = pos.end - pos.start;
  if ((pos.start - stretch*4) < 1 ) {
    pos.start = 1;
  } else {
    pos.start = pos.start - stretch*4;
  }
  if ( (pos.end + stretch*4) > pos.max) {
    pos.end = pos.max;
  } else {
    pos.end = pos.end + stretch*4;
  }

  updateData();
  move();
}


// get default chromosome, start and end from the form
var pos = {
  'chrom': document.forms.region.chrom.value,
  'start': parseInt(document.forms.region.start.value),
  'end': parseInt(document.forms.region.end.value)
}

var features = {};
var strains = {};
var haplotypes = [];

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
// update data
function updateData() {
    // update feture sequence for new region
  features = getFeatures();
  strains = getStrains();
  haplotypes = getHaplotypes();
}
updateData();

// function run on form submition
function submit() {
  pos.chrom = document.forms.region.chrom.value;
  pos.start = parseInt(document.forms.region.start.value);
  pos.end = parseInt(document.forms.region.end.value);
  
  updateData();
}

// chart display
var svg = d3.select('#chart').append("svg:svg");

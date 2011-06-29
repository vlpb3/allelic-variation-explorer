  // put sequence data into sparse array where indexes are positions
    var seq_features = [];

    // iterate over seq object and extract data into sparse arrays
    for (var i = 0; i < seq.length; i++) {
      var feat = seq[i];
      var feat_start = parseInt(feat.start);
      // SNPs have differnet type for each strain
      if (feat.type.match(/^SNP_.*/)) {
        // check if there this position is empty,
        // if it is, create there an empty list
        if (!seq_features[feat_start]){
          seq_features[(feat_start)] = ["SNPs"];
          seq_features[feat_start].SNPs = [];
        } else if(!seq_features[feat_start].SNPs) {
          seq_features[feat_start].SNPs = [];
        };

        // append SNP to the list
        seq_features[feat_start].SNPs.push(feat);
      }
      // for the rest of features just use type for indexing
      else {
        // again first check if position is empty
        // if it is, put empty lists
        if (!seq_features[feat_start]) {
          seq_features[feat_start] = [feat.type];
          seq_features[feat_start][feat.type] = [];
        } else if (!seq_features[feat_start][feat.type]) {
          seq_features[feat_start][feat.type] = [];
        }
        // now append features to the seq_features
        seq_features[feat_start][feat.type].push(feat);
      };
    };

// lists for all features
var features = [];
// strains with sequence strings
var strains = [];
// haplotypes, key = sequence string, value = strain name
var haplotypes = [];

var ongo = function() {

  // get chrom, start and end values from the form
  chrom = parseInt(document.forms.region.chrom.value);
  start = parseInt(document.forms.region.start.value);
  end = parseInt(document.forms.region.end.value);

  // loop over seq_features and extract all features in the region
  // use [type][position][featurelist] indexing
  for (var i = start; i <= end; i++) {
    // if the position is non-empty
    if (seq_features[i]) {
      // loop over all features for this position
      for (var j = 0; j < seq_features[i].length; j++) {
        // if there is no antry for this feature in features array,
        // make one
        var f = String(seq_features[i][j]);
        if (!features[f]) {
          features[f] = [];
        }
        features[f][i] = [];
        // appnend all the features at this position
        features[f][i] = seq_features[i][f];
      }
    }
  }
  // calculate haplotypes
  // (1) generate a list of strains, for each strain a sparse array with snp version
  var snps = features.SNPs;
  for (var i = 0; i < snps.length; i++) {
    if (snps[i]) {
      var pos = snps[i];
      for (var j = 0; j < pos.length; j++) {
        var strain = pos[j];
        // match base change from strain.attributes.Change string (e.g. "Change=T:C")
        var variant = strain.attributes.Change.match(/Change=[ACGT]:([ACGT])/)[1];
        // if no entry for strain, make one
        if (!strains[strain.type]) {
          strains[strain.type] = new Array(end - start + 2);
        }
        // put variant in proper index in an array
        strains[strain.type][i]= variant;
      }
    }
  }
  // (2) get and array for each strain, join() it to get a string,
  //      use this string as a key in haplotypes hash

  for (s in strains) {
    var seq_string = strains[s].join();
    // first check if there is this sequence string among keys if not add one
    if(!haplotypes[seq_string]) {
      haplotypes[seq_string] = [];
    }
    haplotypes[seq_string].push(s);
  }

  // create nicer haplotype storage for easier access
  // iterate over haplotypes
  visualize();
}
// function displaying protovis visualisation
var visualize = function() {
  // calculate the distance between sequence scale lines
  var seq_len = end - start + 1;
  var seq_scale_gap = (Math.pow(String(seq_len).lenfth))/200;
  if (seq_scale_gap < 5 ) { seq_scale_gap = 5;};

  // set size of the view
  var view = {
      left: 25,
      right: 25,
      top: 50,
      bottom: 25,
      width: 750,
      height: 750
  };

  // create a panel
  var vis = new pv.Panel()
    .width(view.width)
    .height(view.height)
    .top(view.top)
    .bottom(view.bottom);
   // .left(view.left)
   // .right(view.right);

  // make a Scale for sequence
  var seqScale = pv.Scale.linear(start, end).range(view.left, view.width - view.right);

  // make a ruller showing sequence scale
  var seqRule = vis.add(pv.Rule)
    .data(seqScale.ticks())
    .left(seqScale)
    .height(view.height - view.bottom)
    .strokeStyle("lightgray")
    .anchor("top").add(pv.Label)
    .textAlign("center");

  // gene track

  // render image
  vis.render();

}
//

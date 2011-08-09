/ Using jQuery's dom:ready but should work with any framework
$(function(){
// Data defined statically but could be pulled in via AJAX
var data = [
  {value:10, label:'New'},
  {value:20, label:'Existing'}
];
// Draw the chart into targetElem
    var w = 200,
        h = 200,
        r = w / 2,
        max = pv.sum(data, function(d){ return d.value; }),
        a = pv.Scale.linear(0, max).range(0, 2 * Math.PI);
    var vis = new pv.Panel()
        .canvas('targetElem')
        .width(w)
        .height(h);
    vis.add(pv.Wedge)
        .data(data)
        .outerRadius(r)
        .angle(function(d) { return a(d.value); })
        .title(function(d) { return d.value; })
      .add(pv.Wedge) // invisible wedge to offset label
        .visible(function(d) { return d.value > 0.15; })
        .innerRadius(0.25 * r)
        .outerRadius(0.75 * r)
        .fillStyle(null)
      .anchor("center").add(pv.Label)
        .textAngle(0)
        .text(function(d) { return d.label; });
    vis.render();
})

 <canvas id="pv_canvas" width="750" height="2000"></canvas>

 .fillStyle(function(d) snpColor[d.attributes.Change.split(":")[1]]);


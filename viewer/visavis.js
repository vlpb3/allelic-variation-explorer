    var dim = {w: 710, h: 100};
    var padding = [20,30,20,40]; // top right bottom left
    var stroke = function(d) { return d ? "#ccc" : "#fff"; };

    var pos = {start: 1, end: 10000};
    var tx = function(d) { return "translate(" + x(d) + ", 0)";};
    var x = d3.scale.linear().domain([pos.start, pos.end]).range([0, dim.w]);

    var svg = d3.select("#chart").append("svg:svg")
            .attr("width", dim.w + padding[1] + padding[3])
            .attr("heeight", dim.h + padding[0] + padding[2])
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

    function zoompan(){

        if (d3.event) d3.event.transform(x);
        redraw();
    }

    function redraw(){


        var fx = x.tickFormat(10);

        var gx = svg.selectAll("g.x")
            .data(x.ticks(10), String)
            .attr("transform", tx);

        gx.select("text")
            .text(fx);

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


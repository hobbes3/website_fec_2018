define([
    "jquery",
    "d3",
    "underscore",
    "js/helper"
],
function(
    $,
    d3,
    _,
    helper
) {
    return function(data, choices) {
        var that = this;

        // Deep copy
        var rows = JSON.parse(JSON.stringify(data))

        that.tooltip = d3.select("#tooltip");
        $("#viz_bar").empty();

        rows = _(rows)
            .chain()
            .filter(function(v) {
                return choices.office == "ALL" ? true : v.office == choices.office;
            })
            .filter(function(v) {
                return choices.state == "ALL" ? true : v.state == choices.state;
            })
            .filter(function(v) {
                if(choices.party == "ALL") {
                    return true;
                }
                else if(choices.party == "OTHERS") {
                    return v.party != "REP" && v.party != "DEM";
                }
                else {
                    return v.party == choices.party;
                }
            })
            .groupBy("inner")
            .map(function(v, k) {
                var o = {
                    "name": k,
                    "count": parseFloat(v[0].schedule_a_total),
                    "party": v[0].party
                };

                return o;
            })
            .value();

        _.mixin({
            "total": function(data, key) {
                return _(data).chain()
                    .pluck(key)
                    .reduce(function(memo, num) {
                        return memo + num;
                    }, 0)
                    .value();
            }
        });

        var total = _(rows).total("count");

        if(rows.length == 0) {
            d3.select("#viz_halo").append("text")
                .attr("x", width / 2)
                .attr("y", 300)
                .attr("alignment-baseline", "middle")
                .attr("text-anchor", "middle")
                .text("No data with the above filters.");
            return;
        }
        else if(total < 1000) {
            d3.select("#viz_halo").append("text")
                .attr("x", width / 2)
                .attr("y", 300)
                .attr("alignment-baseline", "middle")
                .attr("text-anchor", "middle")
                .text("Too little money with the above filters. Total of $" + total + ".");
            return;
        }

        function get_top(d, key, n) {
            return _(d)
                .chain()
                .groupBy(key)
                .map(function(v, k) {
                    var o = {
                        "total": _(v).total("count")
                    };

                    o[key] = k;

                    return o;
                })
                .sortBy("total")
                .reverse()
                .first(n)
                .map(function(v) {
                    return v[key];
                })
                .value();
        }

        var top = get_top(rows, "name", 10);

        var data = _(rows).chain()
            .map(function(o) {
                if(!top.includes(o.name)) {
                    //o.name = "others";
                    o.name = null;
                }

                o.value = o.count;

                return o;
            })
            .filter(function(o) {
                return o.name;
            })
            //.groupBy("name")
            //.map(function(v, k) {
            //    var o = v[0];
            //    o.count = _(v).total("count")

            //    return o;
            //})
            .sort((a, b) => b.value - a.value)
            .value();

        function tooltip_position() {
            that.tooltip
                .style("top", (d3.event.pageY - 10) + "px")
                .style("left", (d3.event.pageX + 10) + "px");
        }

        function pct_label(pct) {
            return pct < 1 ? "<1%" : Math.round(pct) + "%";
        }

        String.prototype.capitalize = function() {
            return this.charAt(0).toUpperCase() + this.slice(1);
        }

        // https://beta.observablehq.com/@mbostock/d3-horizontal-bar-chart

        var format_bar = d3.format("$,d");
        var format_tick = d3.format("$~s");
        var margin = ({top: 30, right: 50, bottom: 10, left: 250});
        var height = data.length * 25 + margin.top + margin.bottom;
        var width = 1500;

        var yAxis = g => g
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSizeOuter(0));

        var xAxis = g => g
            .attr("transform", `translate(0,${margin.top})`)
            .call(d3.axisTop(x).ticks(width / 80).tickFormat(format_tick))
            .call(g => g.select(".domain").remove());

        var y = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([margin.top, height - margin.bottom])
            .padding(0.1);

        var x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value)])
            .range([margin.left, width - margin.right]);

        var svg = d3.select("#viz_bar")
            .attr("width", width)
            .attr("height", height);

        svg.append("g")
            .attr("fill", "steelblue")
            .selectAll("rect")
            .data(data)
            .enter().append("rect")
            .attr("x", x(0))
            .attr("y", d => y(d.name))
            .attr("width", d => x(d.value) - x(0))
            .attr("height", y.bandwidth());

        svg.append("g")
            .attr("fill", "white")
            .attr("text-anchor", "end")
            .style("font", "12px sans-serif")
            .selectAll("text")
            .data(data)
            .enter().append("text")
            .attr("x", d => x(d.value) - 4)
            .attr("y", d => y(d.name) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .text(d => format_bar(d.value));

        svg.append("g")
            .call(xAxis);

        svg.append("g")
            .call(yAxis);

        svg.node();
    };
});


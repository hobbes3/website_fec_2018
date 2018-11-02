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

        var width = 1500;

        // Deep copy
        var rows = JSON.parse(JSON.stringify(data))

        that.tooltip = d3.select("#tooltip");
        $("#viz_bar").empty();

        _.mixin({
            "total": function(data, key) {
                return _(data).chain()
                    .pluck(key)
                    .reduce(function(memo, num) {
                        return memo + parseInt(num);
                    }, 0)
                    .value();
            }
        });

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
                    "name": k + " - " + v[0].office + " - " + v[0].state,
                    "total": v[0].total,
                    "total_e": _(v).total("count"),
                    "total_e_supporting": _(v)
                        .chain()
                        .filter(o => o.ribbon === "supporting")
                        .total("count")
                        .value(),
                    "total_e_opposing": _(v)
                        .chain()
                        .filter(o => o.ribbon === "opposing")
                        .total("count")
                        .value(),
                    "party": v[0].party,
                    "link": v[0].inner_link
                };

                return o;
            })
            .value();

        var total = _(rows).total("total");

        if(rows.length == 0) {
            d3.select("#viz_bar")
                .attr("height", 200)
                .append("text")
                    .attr("x", width / 2)
                    .attr("y", 100)
                    .attr("alignment-baseline", "middle")
                    .attr("text-anchor", "middle")
                    .text("No data with the above filters.");
            return;
        }
        else if(total < 1000) {
            d3.select("#viz_bar")
                .attr("height", 200)
                .append("text")
                    .attr("x", width / 2)
                    .attr("y", 100)
                    .attr("alignment-baseline", "middle")
                    .attr("text-anchor", "middle")
                    .text("Too little money with the above filters. Total of $" + total + ".");
            return;
        }

        function get_top(d, key, value, n) {
            return _(d)
                .chain()
                .groupBy(key)
                .map(function(v, k) {
                    var o = {
                        "total": _(v).total(value)
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

        var top = get_top(rows, "name", "total", 30);

        var data = _(rows).chain()
            .map(function(o) {
                if(!top.includes(o.name)) {
                    //o.name = "others";
                    o.name = null;
                }

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
            .sort((a, b) => b.total - a.total)
            .value();

        function tooltip_position() {
            that.tooltip
                .style("top", (d3.event.pageY - 10) + "px")
                .style("left", (d3.event.pageX + 10) + "px");
        }

        function get_d(name) {
            return _(data).findWhere({"name": name});
        }

        function mouseover(d) {
            var sup = d.total_e_supporting,
                opp = d.total_e_opposing,
                total_e = d.total_e;

            var html = d.name + "<br/>" +
                "⇒ Direct donations: " + format_dollar(d.total) + "<br/>" +
                "Indirect donations: " + format_dollar(d.total_e) + "<br/>" +
                "Indirect donations supporting: " + format_dollar(sup) + " (" + format_pct(sup/total_e) + ")<br/>" +
                "Indirect donations opposing: " + format_dollar(opp) + " (" + format_pct(opp/total_e) + ")<br/>" +
                "<i>Click for more details</i>";

            bar
                .transition()
                .style("opacity", dd => d.name === dd.name ? 1.0 : 0.1);

            bar_label
                .transition()
                .style("opacity", dd => d.name === dd.name ? 1.0 : 0.1);

            that.tooltip
                .style("visibility", "visible")
                .html(html);
        }

        function mouseout_default() {
            that.tooltip.style("visibility", "hidden");

            bar
                .transition()
                .style("opacity", 1.0);

            bar_label
                .transition()
                .style("opacity", 1.0);
        }

        function click(d) {
            window.open(d.link, "_blank");
        }

        function pct_label(pct) {
            return pct < 1 ? "<1%" : Math.round(pct) + "%";
        }

        String.prototype.capitalize = function() {
            return this.charAt(0).toUpperCase() + this.slice(1);
        }

        // https://beta.observablehq.com/@mbostock/d3-horizontal-bar-chart

        var format_dollar = d3.format("$,d");
        var format_tick = d3.format("$~s");
        var format_pct = d3.format(".0%");
        var margin = ({top: 30, right: 50, bottom: 10, left: 250});
        var height = data.length * 25 + margin.top + margin.bottom || 200;

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
            .domain([0, d3.max(data, d => d.total)])
            .range([margin.left, width - margin.right]);

        var svg = d3.select("#viz_bar")
            .attr("width", width)
            .attr("height", height);

        var bar = svg.append("g")
            .selectAll("rect")
            .data(data)
            .enter()
            .append("rect")
                .attr("x", x(0))
                .attr("y", d => y(d.name))
                .attr("width", d => x(d.total) - x(0))
                .attr("height", y.bandwidth())
                .attr("fill", d => {
                    switch(d.party) {
                        case "REP": color = "#d8241e"; break;
                        case "DEM": color = "#1576b6"; break;
                        default: color = "#808080";
                    }
                    return color;
                })
                .style("cursor", "pointer")
                .on("mouseover", mouseover)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", click);

        var width_limit = 100;

        var bar_label = svg.append("g")
            .selectAll("text")
            .data(data)
            .enter()
            .append("text")
                .attr("fill", d => {
                    var width = x(d.total) - x(0);
                    return width > width_limit ? "white" : "black";
                })
                .attr("text-anchor", d => {
                    var width = x(d.total) - x(0);
                    return width > width_limit ? "end" : "start";
                })
                .attr("x", d => {
                    var width = x(d.total) - x(0);

                    return width > width_limit ? x(d.total) - 4 : x(d.total) + 4;
                })
                .attr("y", d => y(d.name) + y.bandwidth() / 2)
                .attr("dy", "0.35em")
                .text(d => format_dollar(d.total))
                .style("cursor", "pointer")
                .on("mouseover", mouseover)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", click);

        svg.append("g")
            .call(xAxis);

        svg.append("g")
            .attr("class", "y_axis")
            .call(yAxis)

        svg.node();

        svg.selectAll(".y_axis .tick")
            .style("cursor", "pointer")
            .on("mouseover", name => { mouseover(get_d(name)); })
            .on("mousemove", tooltip_position)
            .on("mouseout", mouseout_default)
            .on("click", name => { click(get_d(name)); });
    };
});


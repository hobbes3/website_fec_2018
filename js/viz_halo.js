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
        //console.log("updateView");

        //var that = this;

        //if(!that.orig_rows) {
        //    return;
        //}

        //// Deep copy again
        //var rows = JSON.parse(JSON.stringify(that.orig_rows))

        //console.log("clearing");

        //this.$el.find("svg").remove();
        clearTimeout(window.timer_label_relax);
        clearTimeout(window.timer_auto_transition);
        clearTimeout(window.timer_auto_transition_resume);
        $("#select_toward").unbind("change").val("ALL");

        var that = this;

        // Deep copy
        var rows = JSON.parse(JSON.stringify(data))

        that.tooltip = d3.select("#tooltip");
        $("#viz_halo").empty();

        rows = _(rows)
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
            .map(function(o) {
                var num = parseFloat(o.count);

                if(isNaN(num)) {
                    throw new SplunkVisualizationBase.VisualizationError(
                        "All values of the field count must be numeric. Encountered the value: " + o.count
                    );
                }
                else {
                    o.count = num;
                }

                o.inner = o.inner + " - " + o.office + " - " + o.state;

                return o;
            });

        function config_default(setting, default_value) {
            //var value = config[that.getPropertyNamespaceInfo().propertyNamespace + setting];

            //if(value === undefined) {
            //    return default_value;
            //}
            //else {
            //    value = value.trim();
            //}

            //if(value === "") {
            //    return default_value;
            //}

            //return typeof default_value === "number" ? parseFloat(value) : value;

            return default_value;
        }

        var ribbon_choice = "ALL",
            animation = false,
            // descriptions of each config setting in formatter.html
            width                        = config_default("width",                        1300),
            height                       = config_default("height",                       1000),
            radius                       = config_default("radius",                       width / 2 * 0.55),
            radius_label                 = config_default("radius_label",                 radius * 1.1),
            outer_thickness              = config_default("outer_thickness",              radius * 0.07),
            inner_thickness_pct          = config_default("inner_thickness_pct",          0.8),
            ribbon_radius_cp_offset      = config_default("ribbon_radius_cp_offset",      radius * 0.2),
            outer_colors                 = config_default("outer_colors",                 "schemeDark2"),
            radius_pack                  = config_default("radius_pack",                  0.8 * (radius - outer_thickness)),
            padding_pack                 = config_default("padding_pack",                 radius * 0.1),
            opacity_ribbon               = config_default("opacity_ribbon",               0.6),
            opacity_fade                 = config_default("opacity_fade",                 0.1),
            group_outer_limit            = config_default("group_outer_limit",            30),
            group_inner_limit            = config_default("group_inner_limit",            10),
            group_use_others_outer       = config_default("group_use_others_outer",       "true"),
            group_use_others_inner       = config_default("group_use_others_inner",       "false"),
            group_others_outer_label     = config_default("group_others_outer_label",     "others"),
            group_others_inner_label     = config_default("group_others_inner_label",     "others"),
            group_others_inner_color     = config_default("group_others_inner_color",     "#808080"),
            group_others_inner_img       = config_default("group_others_inner_img",       null),
            label_text_color             = config_default("label_text_color",             "#000000"),
            label_line_color             = config_default("label_line_color",             "#000000"),
            label_dot_color              = config_default("label_dot_color",              "#000000"),
            label_font_size              = config_default("label_font_size",              11),
            label_spacing                = config_default("label_spacing",                radius * 0.01),
            label_wrap_length            = config_default("label_wrap_length",            500),
            inner_labels_scale           = config_default("inner_labels_scale",           0.9),
            label_relax_delta            = config_default("label_relax_delta",            0.5),
            label_relax_sleep            = config_default("label_relax_sleep",            10),
            auto_transition              = config_default("auto_transition",              "never"),
            auto_transition_sleep        = config_default("auto_transition_sleep",        2000),
            auto_transition_resume_sleep = config_default("auto_transition_resume_sleep", 5000),
            draggable                    = config_default("draggable",                    "true"),
            transition_duration          = config_default("transition_duration",          750),
            warning_override             = config_default("warning_override",             "false");

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
            d3.select("#viz_halo")
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
            d3.select("#viz_halo")
                .attr("height", 200)
                .append("text")
                    .attr("x", width / 2)
                    .attr("y", 100)
                    .attr("alignment-baseline", "middle")
                    .attr("text-anchor", "middle")
                    .text("Too little money with the above filters. Total of $" + total + ".");
            return;
        }

        function get_top(d, key, n) {
            return _(d).chain()
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

        var top_outer = get_top(rows, "outer", group_outer_limit);
        var top_inner = get_top(rows, "inner", group_inner_limit);

        rows = _(rows).chain()
            .map(function(v) {
                if(!top_outer.includes(v.outer)) {
                    v.outer = group_use_others_outer === "true" ? group_others_outer_label : null;
                }
                if(!top_inner.includes(v.inner)) {
                    v.inner = group_use_others_inner === "true" ? group_others_inner_label : null;
                }

                return v;
            })
            .filter(function(v) {
                return v.outer && v.inner;
            })
            .groupBy(function(v) {
                return v.outer + "|||" + v.ribbon + "|||" + v.inner;
            })
            .map(function(v, k) {
                var obj = v[0];
                obj.count = _(v).total("count")

                if(obj.inner == group_others_inner_label) {
                    obj.inner_img = group_others_inner_img;
                }

                return obj;
            })
            .value();

        if(warning_override === "false") {
            if(group_outer_limit > 100) {
                throw new SplunkVisualizationBase.VisualizationError(
                    'Not recommended to have "Outer Group Limit">100. Decrease this value or enable "Warning Override".'
                );
            }
            if(group_inner_limit > 50) {
                throw new SplunkVisualizationBase.VisualizationError(
                    'Not recommended to have "Inner Group Limit">50. Decrease this value or enable "Warning Override".'
                );
            }
            if(rows.length > 500) {
                throw new SplunkVisualizationBase.VisualizationError(
                    'Not recommended to have over 500 rows/ribbons. Decrease "Outer/Inner Ring Grouping Limit" or enable "Warning Override". Current number of rows/ribbons after grouping: ' + rows.length
                );
            }
        }

        var data = {};

        function by_ribbon(data, inner) {
            return _(data).chain()
                .groupBy("ribbon")
                .map(function(v, k) {
                    var o = {
                        "ribbon": k,
                        "total": _(v).total("count")
                    }

                    if(inner) {
                        o.inner = inner;
                    }

                    return o;
            })
            .value();
        };

        data.stats = {
            "total": _(rows).total("count"),
            "ribbon": by_ribbon(rows, null),
            "inner": _(rows).chain()
                    .groupBy("inner")
                    .map(function(v, k) {
                        return {
                            "inner": k,
                            "total": _(v).total("count"),
                            "ribbon": by_ribbon(v, k)
                        };
                    })
                    .value()
        };

        //$("#select_toward option").not("[value='ALL']").remove();

        //_(data.stats.ribbon).each(function(o) {
        //    $("#select_toward").append('<option value="' + o.ribbon + '">' + o.ribbon + '</option>');
        //});

        data.outer = _(rows).map(function(v, i) {
            v._index = i;

            return v;
        });

        var i = 0;

        data.inner = _(data.outer).chain()
            .groupBy("inner")
            .map(function(v, k) {
                var inner_img = "/img/fec_headshots/" + v[0].inner_img;
                $.ajax({
                    "url": inner_img,
                    "type": "get",
                    "async": false,
                    "error": function() {
                        inner_img = null;
                    }
                });

                var inner_color = (k == group_others_inner_label ? group_others_inner_color : v[0].inner_color) || null;

                return {
                    "_index": i++,
                    "inner": k,
                    "inner_img": inner_img,
                    "inner_link": v[0].inner_link || null,
                    "inner_color": inner_color,
                    "state": v[0].state,
                    "data": v
                };
            })
            .value();

        var color_outer = d3.scaleOrdinal(d3[outer_colors]);

        var format_dollar = d3.format("$,d");
        var format_pct = d3.format(".0%");

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

        //var svg = d3.select(that.el)
        //    .append("svg")
        var svg = d3.select("#viz_halo")
                .attr("width", width)
                .attr("height", height)
                //.attr("id", "halo")
            .append("g")
                .attr("transform", "translate(" + [width / 2, height / 2] + ")");

        var outer = svg
            .append("g")
                .attr("class", "outer");

        var middle = svg
            .append("g")
                .attr("class", "middle");

        var inner = svg
            .append("g")
                .attr("class", "inner")
                .attr("transform", "translate(" + [-radius_pack, -radius_pack] + ")");

        var label = svg
            .append("g")
                .attr("class", "front");

        var arc_outer = d3.arc()
            .innerRadius(radius - outer_thickness)
            .outerRadius(radius);

        var pie_outer = d3.pie()
            .value(function(d) {
                return d.ribbon === ribbon_choice || ribbon_choice === "ALL" ? d.count : 0;
            })
            .sort(null);

        function mouseout_default() {
            if(animation) return;

            that.tooltip.style("visibility", "hidden");

            path_outer_g
                .transition()
                .style("opacity", 1.0);

            ribbon
                .transition()
                .style("opacity", opacity_ribbon);

            path_inner_g
                .transition()
                .style("opacity", 1.0);

            image
                .transition()
                .style("opacity", 1.0);

            inner_label_text
                .transition()
                .style("opacity", 1.0);

            inner_circle_outline
                .transition()
                .style("opacity", 1.0);
        }

        function mouseover_outer(d) {
            stop_auto_animation();

            if(animation) return;

            var outer_label = d.data.outer.capitalize(),
                ribbon_label = d.data.ribbon,
                inner_label = d.data.inner.capitalize(),
                count = d.data.count,
                total = data.stats.total,
                total_ribbon = _(data.stats.ribbon).findWhere({"ribbon": ribbon_label}).total,
                pct = count / total * 100,
                pct_ribbon = count / total_ribbon * 100;

            var html = outer_label + " " + ribbon_label + " " + inner_label + ": " + format_dollar(count);

            if(d.data.outer_link) {
                html += "<br><i>Click for more details</i>";
            }

            that.tooltip
                .style("visibility", "visible")
                .html(html);

            path_outer_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            ribbon
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? opacity_ribbon : opacity_fade;
                });

            path_inner_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            image
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_label_text
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_circle_outline
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });
        }

        var path_outer_g = outer.selectAll("g.arc_outer")
            .data(pie_outer(data.outer))
            .enter()
            .append("g")
                .attr("class", "arc_outer")
                .style("cursor", function(d) {
                    return d.data.outer_link ? "pointer" : "";
                })
                .on("mouseover", mouseover_outer)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", function(d) {
                    var link = d.data.outer_link;

                    if(link) {
                        window.open(link, "_blank");
                    }
                });

        var path_outer = path_outer_g
            .append("path")
                .attr("d", arc_outer)
                .attr("fill", function(d) {
                    return color_outer(d.data.outer);
                })
                .each(function(d) {
                    this._current = d;
                });

        var unique_outer = [];

        var label_group = label.selectAll("g.label-group")
            .data(pie_outer(data.outer))
            .enter()
            .append("g")
                .attr("class", "label-group")
                .style("opacity", function(d) {
                    if(label_font_size > 0 && !unique_outer.includes(d.data.outer)) {
                        unique_outer.push(d.data.outer);
                        return 1.0;
                    }

                    return 0.0;
                })
                .attr("visibility", function(d) {
                    return $(this).css("opacity") == "1" ? "visible" : "hidden";
                })
                .style("cursor", function(d) {
                    return d.data.outer_link ? "pointer" : "";
                })
                .on("mouseover", mouseover_outer)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", function(d) {
                    var link = d.data.outer_link;

                    if(link) {
                        window.open(link, "_blank");
                    }
                });

        var label_circle = label_group
            .append("circle")
                .attr("x", 0)
                .attr("y", 0)
                .attr("r", 2)
                .attr("fill", label_dot_color)
                .attr("transform", function (d, i) {
                    return "translate(" + arc_outer.centroid(d) + ")";
                })
                .attr("class", "label-circle")
                .each(function(d) {
                    this._current = d;
                });

        var label_line = label_group
            .append("line")
                .attr("x1", function (d) {
                    return arc_outer.centroid(d)[0];
                })
                .attr("y1", function (d) {
                    return arc_outer.centroid(d)[1];
                })
                .attr("x2", function (d) {
                    var c = arc_outer.centroid(d),
                        mid_angle = Math.atan2(c[1], c[0]),
                        x = Math.cos(mid_angle) * radius_label;
                    return x;
                })
                .attr("y2", function (d) {
                    var c = arc_outer.centroid(d),
                        mid_angle = Math.atan2(c[1], c[0]),
                        y = Math.sin(mid_angle) * radius_label;
                    return y;
                })
                .attr("stroke", label_line_color)
                .attr("class", "label-line")
                .each(function(d) {
                    this._current = d;
                });

        // https://stackoverflow.com/a/3700369/1150923
        function unescapeHtml(encoded) {
            var elem = document.createElement('textarea');
            elem.innerHTML = encoded;
            var decoded = elem.value;

            return decoded;
        }

        // https://bl.ocks.org/mbostock/7555321
        function label_wrap(text, width) {
            text.each(function() {
                var text = d3.select(this),
                    g = d3.select(this.parentNode),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    wrapped = false,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null)
                        .append("tspan")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("dy", dy + "em");
                while(word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if(tspan.node().getComputedTextLength() > width) {
                        wrapped = true;
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text
                            .append("tspan")
                                .attr("x", 0)
                                .attr("y", 0)
                                .attr("dy", ++lineNumber * lineHeight + dy + "em")
                                .text(word);

                    }
                }
            });
        }

        // Based off of https://jsfiddle.net/thudfactor/HdwTH/
        function label_relax() {
            //console.log("label_relax()");

            function get_translate(translate) {
                var match = /^translate\(([^,]+),(.+)\)/.exec(translate);
                return [parseFloat(match[1]), parseFloat(match[2])];
            }

            var adjusted = false;
            label_text_g
                .filter(function() {
                    return d3.select(this.parentNode).attr("visibility") !== "hidden";
                })
                .each(function() {
                    var a = this;

                    label_text_g
                        .filter(function() {
                            return d3.select(this.parentNode).attr("visibility") !== "hidden";
                        })
                        .each(function () {
                            var b = this,
                                da = d3.select(a),
                                db = d3.select(b),
                                ta = da.select("text").attr("text-anchor"),
                                tb = db.select("text").attr("text-anchor");

                            if(a === b || ta !== tb) return;

                            var ra = a.getBoundingClientRect(),
                                rb = b.getBoundingClientRect();

                            var overlap = ra.top - label_spacing < rb.bottom &&
                                        rb.top - label_spacing < ra.bottom &&
                                        ra.left - label_spacing < rb.right &&
                                        rb.left - label_spacing < ra.right;

                            // There seems to be "ghost" elements floating around (probably due to multiple updateView calls).
                            // These ghost elements have ra and rb of all 0's. So my hacky solution to exclude these elements is to check for 0's...
                            if(!overlap || ra.height === 0 && rb.height === 0) {
                                return;
                            }

                            adjusted = true;

                            var fa = get_translate(da.attr("transform")),
                                fb = get_translate(db.attr("transform")),
                                xa = fa[0],
                                ya = fa[1],
                                xb = fb[0],
                                yb = fb[1],
                                aa = da.datum().endAngle,
                                ab = db.datum().endAngle,
                                adjust = ta === "start" && aa > ab || ta === "end" && aa < ab ? label_relax_delta : -label_relax_delta;

                            da.attr("transform", "translate(" + [xa, ya + adjust] + ")");
                            db.attr("transform", "translate(" + [xb, yb - adjust] + ")");
                        });
                });

            if(adjusted) {
                label_line.attr("y2", function(d, i) {
                    var g_for_line = label_text_g.filter(function(dd, ii) {
                        return i === ii;
                    });
                        y = get_translate(g_for_line.attr("transform"))[1];
                    return y;
                });

                window.timer_label_relax = setTimeout(label_relax, label_relax_sleep)
            }
        }

        var label_text_g = label_group
            .append("g")
                .attr("class", "label-text-group")
                .attr("transform", function(d) {
                    var c = arc_outer.centroid(d),
                        mid_angle = Math.atan2(c[1], c[0]),
                        x = Math.cos(mid_angle) * radius_label,
                        sign = (x > 0) ? 1 : -1,
                        label_x = x + (2 * sign),
                        label_y = Math.sin(mid_angle) * radius_label;
                    return "translate(" + [label_x, label_y] + ")";
                })
                .each(function(d) {
                    this._current = d;
                });

        var label_text = label_text_g
            .append("text")
                .attr("x", 0)
                .attr("y", 0)
                .attr("dy", "0em")
                .attr("text-anchor", function (d) {
                    var c = arc_outer.centroid(d),
                        mid_angle = Math.atan2(c[1], c[0]),
                        x = Math.cos(mid_angle) * radius_label;
                    return (x > 0) ? "start" : "end";
                })
                .attr("fill", label_text_color)
                .attr("class", "label-text")
                .attr("dominant-baseline", "middle")
                .style("font-size", label_font_size)
                .text(function (d) {
                    return unescapeHtml(d.data.outer);
                })
                .each(function(d) {
                    this._current = d;
                })
                .call(label_wrap, label_wrap_length);

        label_relax();

        var bubble_inner = d3.pack()
            .size([2 * radius_pack, 2 * radius_pack])
            .padding(padding_pack);

        var root = d3.hierarchy({"children": data.inner})
            .sum(function(d) {
                //if(!d.inner) {
                //    d.data = _(d.children).chain()
                //        .pluck("data")
                //        .flatten()
                //        .value();
                //}

                return _(d.data).chain()
                    .filter(function(v) {
                        return v.ribbon === ribbon_choice || ribbon_choice === "ALL";
                    })
                    .pluck("count")
                    .reduce(function(memo, num) {
                        return memo + num;
                    }, 0)
                    .value();
            });

        var drag = d3.drag()
            .on("start", function() {
                animation = true;
                that.tooltip.style("visibility", "hidden");
            })
            .on("drag", function(d) {
                var relative_x = d3.event.x - radius_pack,
                    relative_y = radius_pack - d3.event.y,
                    relative_r = Math.sqrt(Math.pow(relative_x, 2) + Math.pow(relative_y, 2)),
                    limit_r = radius - 2 * outer_thickness - d.r;

                if(relative_r >= limit_r) {
                    var theta = Math.atan2(relative_y, relative_x),
                        new_relative_x = limit_r * Math.cos(theta),
                        new_relative_y = limit_r * Math.sin(theta);

                    d.x = new_relative_x + radius_pack;
                    d.y = -new_relative_y + radius_pack;
                }
                else {
                    d.x = d3.event.x;
                    d.y = d3.event.y;
                }

                d3.select(this).attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")";
                });

                ribbon
                    .filter(function(dd) {
                        return dd.data.inner ===  d.data.inner;
                    })
                    .each(function(dd) {
                        dd.node_x = d.x;
                        dd.node_y = d.y;

                        d3.select(this).attr("d", ribbon_d_path(dd));

                        this._current = dd;
                    });
            })
            .on("end", function() {
                animation = false;
            });

        var node_inner_g = inner.selectAll("g.node_inner")
            .data(bubble_inner(root).children)
            .enter()
            .append("g")
                .attr("class", "node_inner")
                .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")";
                });

        if(draggable === "true") {
            node_inner_g.call(drag);
        }

        var image_clip = node_inner_g
            .append("defs")
            .append("clipPath")
                .attr("id", function(d) {
                    return "clip_" + d.data._index;
                })
            .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", function(d) {
                    return d.r * inner_thickness_pct;
                });

        function mouseover_center(d) {
            stop_auto_animation();

            if(animation) return;

            var inner_label = d.data.inner.capitalize(),
                all_arrow = "",
                sup_arrow = "",
                opp_arrow = "",
                total_e = _(d.data.data).total("count"),
                sup = _(d.data.data).chain().filter(o => o.ribbon == "supporting").total("count").value(),
                opp = _(d.data.data).chain().filter(o => o.ribbon == "opposing").total("count").value();

            switch(ribbon_choice) {
                case "supporting": sup_arrow = "⇒ "; break;
                case "opposing": opp_arrow = "⇒ "; break;
                default: all_arrow = "⇒ ";
            }

            var html = inner_label + "<br/>" +
                "Direct donations: " + format_dollar(parseInt(d.data.data[0].total)) + "<br/>" +
                all_arrow + "Indirect donations: " + format_dollar(total_e) + "<br/>" +
                sup_arrow + "Indirect donations supporting: " + format_dollar(sup) + " (" + format_pct(sup/total_e) + ")<br/>" +
                opp_arrow + "Indirect donations opposing: " + format_dollar(opp) + " (" + format_pct(opp/total_e) + ")<br/>" +
                "<i>Click for more details</i>";

            that.tooltip
                .style("visibility", "visible")
                .html(html);

            path_outer_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            ribbon
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? opacity_ribbon : opacity_fade;
                });

            path_inner_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            image
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_label_text
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_circle_outline
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });
        }

        function click_center(d) {
            var link = d.data.inner_link;

            if(link) {
                window.open(link, "_blank");
            }
        }

        var image = node_inner_g
            .append("image")
                .attr("x", function(d) {
                    return -d.r * inner_thickness_pct;
                })
                .attr("y", function(d) {
                    return -d.r * inner_thickness_pct;
                })
                .attr("width", function(d) {
                    return 2 * (d.r * inner_thickness_pct);
                })
                .attr("height", function(d) {
                    return 2 * (d.r * inner_thickness_pct);
                })
                .attr("xlink:href", function(d) {
                    return d.data.inner_img;
                })
                .style("cursor", function(d) {
                    return d.data.inner_link ? "pointer" : "";
                })
                .style("clip-path", function(d) {
                    return "url(#clip_" + d.data._index + ")";
                })
                .on("mouseover", mouseover_center)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", click_center);

        var arc_inner = d3.arc();

        var pie_inner = d3.pie()
            .value(function(d) {
                return d.ribbon === ribbon_choice || ribbon_choice === "ALL" ? d.count : 0;
            })
            .sort(null);

        function mouseover_inner(d) {
            stop_auto_animation();

            if(animation) return;

            var outer_label = d.data.outer.capitalize(),
                inner_name = d.data.inner,
                inner_label = inner_name.capitalize(),
                ribbon_label = d.data.ribbon,
                count = d.data.count,
                total = _(data.stats.inner).findWhere({"inner": inner_name}).total,
                total_ribbon = _(_(data.stats.inner).findWhere({"inner": inner_name}).ribbon).findWhere({"ribbon": ribbon_label}).total,
                pct = count / total * 100,
                pct_ribbon = count / total_ribbon * 100;

            var html = outer_label + " " + ribbon_label + " " + inner_label + ": " + format_dollar(count);

            that.tooltip
                .style("visibility", "visible")
                .html(html);

            path_outer_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            ribbon
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? opacity_ribbon : opacity_fade;
                });

            path_inner_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            image
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_label_text
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_circle_outline
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });
        }

        var path_inner_g = node_inner_g.selectAll("g.arc_inner")
            .data(function(d) {
                return pie_inner(d.data.data).map(function(m) {
                    m.r = d.r;
                    return m;
                });
            })
            .enter()
            .append("g")
                .attr("class", "arc_inner")
                .on("mouseover", mouseover_inner)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default);

        var inner_circle_outline = node_inner_g
            .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", function(d) {
                    return d.r * inner_thickness_pct;
                })
                .attr("fill", "none")
                .attr("stroke-width", function(d) {
                    return d.r * inner_thickness_pct * 0.1;
                })
                .attr("stroke", function(d) {
                    return d.data.inner_color;
                });

        var inner_label_text = node_inner_g
            .append("text")
                .attr("class", "label-inner")
                .attr("x", 0)
                .attr("y", 0)
                .attr("alignment-baseline", "middle")
                .attr("text-anchor", "middle")
                .attr("opacity", 1.0)
                .attr("visibility", inner_labels_scale > 0 ? "visible" : "hidden")
                .text(function(d) {
                    return unescapeHtml(d.data.inner);
                })
                .style("cursor", function(d) {
                    return d.data.inner_link ? "pointer" : "";
                })
                .on("mouseover", mouseover_center)
                .on("mousemove", tooltip_position)
                .on("mouseout", mouseout_default)
                .on("click", click_center);

        function inner_label_resize(d) {
            var bb = this.getBBox();

            if(bb.width === 0 && bb.height === 0) {
                return "";
            }

            var r = d.r * inner_thickness_pct,
                h = 2 * r / bb.height,
                w = 2 * r / bb.width,
                s = w < h ? w : h,
                s = Math.max(s * inner_labels_scale, 1);

            var translate = d.data.inner_img ? "translate(0," + r + ")" : "";

            return translate + " scale(" + s + "," + s + ")";
        }

        node_inner_g.selectAll("text.label-inner")
            .attr("transform", inner_label_resize)
            .style("text-shadow", "-2px 0 black, 0 2px black, 2px 0 black, 0 -2px black");

        function ribbon_data(data) {
            return pie_outer(data.outer).map(function(d) {
                var node = bubble_inner(root).children
                    .filter(function(dd) {
                        return dd.data.inner === d.data.inner;
                    });

                d.node_x = node[0].x;
                d.node_y = node[0].y;
                d.node_r = node[0].r;

                var inner = pie_inner(_(data.inner).findWhere({"inner": d.data.inner}).data)
                    .filter(function(dd) {
                        return d.data._index === dd.data._index;
                    });

                d.inner_startAngle = inner[0].startAngle;
                d.inner_endAngle = inner[0].endAngle;

                return d;
            });
        }

        function ribbon_d_path(d) {
            if(d.value === 0) return "";

            var r_o = radius - outer_thickness,
                offset = -Math.PI / 2,
                path_o_start = d.startAngle + offset,
                path_o_end   = d.endAngle   + offset,
                cx_i = -radius_pack + d.node_x,
                cy_i = -radius_pack + d.node_y,
                path_i_start = d.inner_startAngle + offset,
                path_i_end   = d.inner_endAngle   + offset,
                angle_diff = ((path_o_start + path_o_end) / 2 + (path_i_start + path_i_end) / 2) / 2,
                r_i = d.node_r,
                path = d3.path();

            path.arc(0, 0, r_o, path_o_start, path_o_end);
            path.bezierCurveTo(
                r_o * Math.cos(path_o_end),
                r_o * Math.sin(path_o_end),
                cx_i + (r_i + ribbon_radius_cp_offset) * Math.cos(path_i_end),
                cy_i + (r_i + ribbon_radius_cp_offset) * Math.sin(path_i_end),
                cx_i + r_i * Math.cos(path_i_end),
                cy_i + r_i * Math.sin(path_i_end)
            );
            path.arc(cx_i, cy_i, r_i, path_i_end, path_i_start, true);
            path.bezierCurveTo(
                cx_i + (r_i + ribbon_radius_cp_offset) * Math.cos(path_i_start),
                cy_i + (r_i + ribbon_radius_cp_offset) * Math.sin(path_i_start),
                r_o * Math.cos(path_o_start),
                r_o * Math.sin(path_o_start),
                r_o * Math.cos(path_o_start),
                r_o * Math.sin(path_o_start)
            );

            return path.toString();
        }

        function mouseover_ribbon(d) {
            stop_auto_animation();

            if(animation) return;

            var outer_label = d.data.outer.capitalize(),
                ribbon_label = d.data.ribbon,
                inner_label = d.data.inner.capitalize(),
                count = d.data.count;

            var html = outer_label + " " + ribbon_label + " " + inner_label + ": " + format_dollar(count);

            that.tooltip
                .style("visibility", "visible")
                .html(html);

            path_outer_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            ribbon
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? opacity_ribbon : opacity_fade;
                });

            path_inner_g
                .transition()
                .style("opacity", function(dd) {
                    return d.data._index === dd.data._index ? 1.0 : opacity_fade;
                });

            image
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_label_text
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });

            inner_circle_outline
                .transition()
                .style("opacity", function(dd) {
                    return d.data.inner === dd.data.inner ? 1.0 : opacity_fade;
                });
        }

        var ribbon = middle.selectAll("path")
            .data(ribbon_data(data))
            .enter()
            .append("path")
                .attr("d", function(d) {
                    return ribbon_d_path(d);
                })
                .attr("class", "ribbon")
                .style("opacity", opacity_ribbon)
                .attr("fill", function(d) {
                    return d.data.ribbon_color;
                })
                .on("mouseover", mouseover_ribbon)
                .on("mouseout", mouseout_default)
                .on("mousemove", tooltip_position)
                .each(function(d) {
                    this._current = d;
                });

        path_inner = path_inner_g
            .append("path")
                .attr("d", function(d) {
                    d.innerRadius = d.r * inner_thickness_pct;
                    d.outerRadius = d.r;

                    return arc_inner(d);
                })
                .style("fill", function(d) {
                    return d.data.ribbon_color;
                })
                .each(function(d) {
                    this._current = d;
                });


        function ribbon_controls_choose_next() {
            //console.log("ribbon_controls_choose_next()");

            var n = $("#ribbon_controls option").length,
                i = $("#ribbon_controls option:selected").index(),
                x = i + 1 >= n ? 0 : i + 1;

            $("#ribbon_controls option:eq(" + x + ")").prop("selected", true).change();
        }

        function start_auto_transition() {
            if(auto_transition !== "never") {
                window.timer_auto_transition = setInterval(ribbon_controls_choose_next, auto_transition_sleep);
            }
        }

        function stop_auto_animation() {
            if(auto_transition === "always") {
                return;
            }

            clearTimeout(window.timer_auto_transition);
            clearTimeout(window.timer_auto_transition_resume);

            if(auto_transition === "resume") {
                window.timer_auto_transition_resume = setTimeout(start_auto_transition, auto_transition_resume_sleep);
            }
        }

        start_auto_transition();

        $("#select_toward")
            .on("click", stop_auto_animation)
            .on("change", function() {
                //console.log("on_change");
                that.tooltip.style("visibility", "hidden");
                path_outer_g.style("opacity", 1.0);
                ribbon.style("opacity", opacity_ribbon);
                path_inner_g.style("opacity", 1.0);
                image.style("opacity", 1.0);

                var ribbon_choice_previous = ribbon_choice;
                ribbon_choice = this.value;

                if(ribbon_choice === ribbon_choice_previous) {
                    return;
                }

                animation = true;

                path_outer.data(pie_outer(data.outer))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("d", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return arc_outer(i(t));
                            };
                        });

                var unique_outer = [];

                label_group
                    .attr("visibility", "visible")
                    .transition()
                    .duration(transition_duration)
                        .style("opacity", function(d) {
                            if(label_font_size > 0 && !unique_outer.includes(d.data.outer) && (d.data.ribbon === ribbon_choice || ribbon_choice === "ALL")) {
                                unique_outer.push(d.data.outer);
                                return 1.0;
                            }

                            return 0.0;
                        })
                        .on("end", function() {
                            d3.select(this).attr("visibility", function(d) {
                                return $(this).css("opacity") == "1" ? "visible" : "hidden";
                            });
                        });

                label_circle.data(pie_outer(data.outer))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("transform", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return "translate(" + arc_outer.centroid(i(t)) + ")";
                            };
                        });

                label_line.data(pie_outer(data.outer))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("x1", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return arc_outer.centroid(i(t))[0];
                            };
                        })
                        .attrTween("y1", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return arc_outer.centroid(i(t))[1];
                            };
                        })
                        .attrTween("x2", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                var c = arc_outer.centroid(i(t)),
                                    mid_angle = Math.atan2(c[1], c[0]);
                                return Math.cos(mid_angle) * radius_label;
                            };
                        })
                        .attrTween("y2", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                var c = arc_outer.centroid(i(t)),
                                    mid_angle = Math.atan2(c[1], c[0]);
                                return Math.sin(mid_angle) * radius_label;
                            };
                        });

                label_text_g.data(pie_outer(data.outer))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("transform", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                var c = arc_outer.centroid(i(t)),
                                    mid_angle = Math.atan2(c[1], c[0]),
                                    x = Math.cos(mid_angle) * radius_label,
                                    adjust = x > 0 ? 5 : -5,
                                    label_x = x + adjust,
                                    label_y = Math.sin(mid_angle) * radius_label;
                                return "translate(" + [label_x, label_y] + ")";
                            };
                        });

                function end_all(transition, callback) {
                    var n = 0;
                    transition
                        .on("start", function() { ++n; })
                        .on("end", function() {
                            if(!--n) callback.apply(this, arguments);
                        });
                }

                label_text.data(pie_outer(data.outer))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("text-anchor", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                var c = arc_outer.centroid(i(t)),
                                    mid_angle = Math.atan2(c[1], c[0]),
                                    x = Math.cos(mid_angle) * radius_label;
                                return x > 0 ? "start" : "end";
                            };
                        })
                        .call(end_all, function() {
                            animation = false;
                            mouseout_default();
                            label_relax();
                        });

                root = d3.hierarchy({"children": data.inner})
                    .sum(function(d) {
                        //if(!d.inner) {
                        //    d.data = _(d.children).chain()
                        //        .pluck("data")
                        //        .flatten()
                        //        .value();
                        //}

                        return _(d.data).chain()
                            .filter(function(v) {
                                return v.ribbon === ribbon_choice || ribbon_choice === "ALL";
                            })
                            .pluck("count")
                            .reduce(function(memo, num) {
                                return memo + num;
                            }, 0)
                            .value();
                    });

                node_inner_g
                    .data(bubble_inner(root).children)
                    .transition()
                    .duration(transition_duration)
                        .attr("transform", function(d) {
                            return "translate(" + [d.x, d.y] + ")"
                        })
                        .style("opacity", function(d) {
                            return d.value === 0 ? 0.0 : 1.0;
                        });

                path_inner
                    .data(function(d) {
                        return pie_inner(d.data.data).map(function(m) {
                            m.r = d.r;
                            return m;
                        })
                    })
                    .transition()
                    .duration(transition_duration)
                        .attrTween("d", function(d) {
                            d.innerRadius = d.r * inner_thickness_pct;
                            d.outerRadius = d.r;
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return arc_inner(i(t));
                            };
                        });

                ribbon.data(ribbon_data(data))
                    .transition()
                    .duration(transition_duration)
                        .attrTween("d", function(d) {
                            var i = d3.interpolate(this._current, d);
                            this._current = i(0);
                            return function(t) {
                                return ribbon_d_path(i(t));
                            };
                        })
                        .style("opacity", function(d) {
                            return d.value === 0 ? 0.0 : opacity_ribbon;
                        });

                inner_circle_outline.data(bubble_inner(root).children)
                    .transition()
                    .duration(transition_duration)
                        .attr("r", function(d) {
                            return d.r * inner_thickness_pct;
                        })
                        .attr("stroke-width", function(d) {
                            return d.r * inner_thickness_pct * 0.1;
                        });

                image_clip.data(bubble_inner(root).children)
                    .transition()
                    .duration(transition_duration)
                        .attr("r", function(d) {
                            return d.r * inner_thickness_pct;
                        });

                image.data(bubble_inner(root).children)
                    .transition()
                    .duration(transition_duration)
                        .attr("x", function(d) {
                            return -d.r * inner_thickness_pct;
                        })
                        .attr("y", function(d) {
                            return -d.r * inner_thickness_pct;
                        })
                        .attr("width", function(d) {
                            return 2 * d.r * inner_thickness_pct;
                        })
                        .attr("height", function(d) {
                            return 2 * d.r * inner_thickness_pct;
                        });

                inner_label_text.data(bubble_inner(root).children)
                    .transition()
                    .duration(transition_duration)
                        .attr("transform", inner_label_resize)
                        .attr("visibility", inner_labels_scale > 0 ? "visible" : "hidden")
                        .on("end", function() {
                            d3.select(this)
                                .style("text-shadow", "-2px 0 black, 0 2px black, 2px 0 black, 0 -2px black")
                                .attr("visibility", function(d) {
                                    return d.value === 0 || inner_labels_scale === 0 ? "hidden" : "visible";
                                });
                        });
                });
    };
});

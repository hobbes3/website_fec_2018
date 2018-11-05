require([
    "jquery",
    "d3",
    "underscore",
    "moment",
    "js/helper",
    "js/viz_halo",
    "js/viz_bar"
],
function(
    $,
    d3,
    _,
    moment,
    helper,
    viz_halo,
    viz_bar
) {
    // https://stackoverflow.com/a/49534634/1150923
    var files = ["/data/data.csv"];

    var choices = {
        "office": "ALL",
        "state": "ALL",
        "party": "ALL",
        "sort": "alpha",
        "sort_by": "asc"
    };

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

    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

    var format_dollar_select = d3.format("$,.3f");
    var format_dollar = d3.format("$,d");
    var format_pct = d3.format(".0%");

    Promise.all(files.map(url => d3.csv(url))).then(function(values) {
        var data = _(values[0]).map(o => {
            o.count = parseFloat(o.count);
            o.total = parseFloat(o.total);
            return o;
        });

        var total_e, total;

        function update_totals(choices) {
            var filtered_data = _(data)
                .filter(o => (choices.office == "ALL" || choices.office == o.office) &&
                    (choices.state == "ALL" || choices.state == o.state) &&
                    (choices.party == "ALL" || choices.party == o.party)
                );

            total = _(filtered_data).total("total");
            total_e = _(filtered_data).total("count");

            $("#total").text(format_dollar(total));
            $("#total_e").text(format_dollar(total_e));
        }

        function create_select(choices, select) {
            var select_data = _(data).chain()
                .filter(o => {
                    switch(select) {
                        case "office": return (choices.state == "ALL" || choices.state == o.state) && (choices.party == "ALL" || choices.party == o.party);
                        case "state": return (choices.office == "ALL" || choices.office == o.office) && (choices.party == "ALL" || choices.party == o.party);
                        case "party": return (choices.office == "ALL" || choices.office == o.office) && (choices.state == "ALL" || choices.state == o.state);
                    }
                })
                .groupBy(select)
                .map((v, k) => {
                    var o = {
                        "total": _(v).total("total"),
                        "total_e": _(v).total("count")
                    }

                    o[select] = k;
                    o[select + "_full"] = v[0][select + "_full"];

                    return o;
                })
                .value();

            if(choices.sort == "alpha") {
                select_data = _(select_data).sortBy(select + "_full");
            }
            else {
                select_data = _(select_data).sortBy(choices.sort);
            }

            if(choices.sort_by == "desc") {
                select_data = _(select_data).reverse();
            }

            $("#select_" + select).find('option[value!=ALL]').remove();

            $(select_data).each((i, o) => {
                $("#select_" + select).append('<option value="' + o[select] + '">' +
                    o[select + "_full"] +
                    ' - D: ' + format_dollar_select(o.total/1E6) + 'M' +
                    ' - I: ' + format_dollar_select(o.total_e/1E6) + 'M' +
                    '</option>'
                )
            });

            $("#select_" + select).val(choices[select]);
        }

        function create_toward_select(choices) {
            var toward_data = _(data).chain()
                .filter(o => (o.ribbon != "null") &&
                    (choices.office == "ALL" || choices.office == o.office) &&
                    (choices.state == "ALL" || choices.state == o.state) &&
                    (choices.party == "ALL" || choices.party == o.party)
                )
                .groupBy("ribbon")
                .map((v, k) => ({
                    "ribbon": k,
                    "total_e": _(v).total("count")
                }))
                .reverse()
                .value();

            $("#select_toward").find('option[value!=ALL]').remove();

            $(toward_data).each((i, o) => {
                $("#select_toward").append('<option value="' + o.ribbon + '">' +
                    o.ribbon.capitalize() +
                    ' - I: ' + format_dollar_select(o.total_e/1E6) + 'M (' + format_pct(o.total_e/total_e) + ')' +
                    '</option>'
                )
            });
        }

        update_totals(choices);
        create_select(choices, "office");
        create_select(choices, "state");
        create_select(choices, "party");
        create_toward_select(choices);
        viz_halo(data, choices);
        viz_bar(data, choices);
        last_choices = _(choices).clone();

        $("#select_office, #select_state, #select_party, input[name=sort], input[name=sort_by]").on("change", function() {
            choices.office = $("#select_office").val();
            choices.state  = $("#select_state").val();
            choices.party  = $("#select_party").val();
            choices.sort  = $("input[name=sort]:checked").val();
            choices.sort_by  = $("input[name=sort_by]:checked").val();

            update_totals(choices);

            _(choices).mapObject((v, k) => {
                if(last_choices[k] == v) {
                    create_select(choices, k);
                }
            });

            create_toward_select(choices);
            viz_halo(data, choices);
            viz_bar(data, choices);
            last_choices = _(choices).clone();
        });

        $("#reset").on("click", e => {
            choices = {
                "office": "ALL",
                "state": "ALL",
                "party": "ALL",
                "sort": "alpha",
                "sort_by": "asc"
            };

            update_totals(choices);
            create_select(choices, "office");
            create_select(choices, "state");
            create_select(choices, "party");
            create_toward_select(choices);
            viz_halo(data, choices);
            viz_bar(data, choices);
            last_choices = _(choices).clone();
        });
    });
});

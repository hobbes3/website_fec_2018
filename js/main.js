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
        "state":  "ALL",
        "party":  "ALL"
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

        var total = _(data).total("total");
        var total_e = _(data).total("count");

        $("#total").text(format_dollar(total));
        $("#total_e").text(format_dollar(total_e));

        function create_selects(choices) {
            var office_data = _(data).chain()
                .groupBy("office")
                .map((v, k) => ({
                    "office": k,
                    "office_full": v[0].office_full,
                    "total": _(v).total("total"),
                    "total_e": _(v).total("count")
                }))
                .value();

            $(office_data).each((i, o) => {
                $("#select_office").append('<option value="' + o.office + '">' +
                    o.office_full +
                    ' - Direct Donation: ' + format_dollar_select(o.total/1E6) + 'M' +
                    ' - Indirect Donation: ' + format_dollar_select(o.total_e/1E6) + 'M' +
                    '</option>'
                )
            });

            var state_data = _(data).chain()
                .groupBy("state")
                .map((v, k) => ({
                    "state": k,
                    "state_full": v[0].state_full,
                    "total": _(v).total("total"),
                    "total_e": _(v).total("count")
                }))
                .sortBy("state_full")
                .value();

            $(state_data).each((i, o) => {
                $("#select_state").append('<option value="' + o.state + '">' +
                    o.state_full +
                    ' - Direct Donation: ' + format_dollar_select(o.total/1E6) + 'M' +
                    ' - Indirect Donation: ' + format_dollar_select(o.total_e/1E6) + 'M' +
                    '</option>'
                )
            });

            var party_data = _(data).chain()
                .groupBy("party")
                .map((v, k) => ({
                    "party": k,
                    "party_full": v[0].party_full,
                    "total": _(v).total("total"),
                    "total_e": _(v).total("count")
                }))
                .sortBy("total")
                .reverse()
                .value();

            $(party_data).each((i, o) => {
                $("#select_party").append('<option value="' + o.party + '">' +
                    o.party_full +
                    ' - Direct Donation: ' + format_dollar_select(o.total/1E6) + 'M' +
                    ' - Indirect Donation: ' + format_dollar_select(o.total_e/1E6) + 'M' +
                    '</option>'
                )
            });

            var toward_data = _(data).chain()
                .filter(o => o.ribbon != "null")
                .groupBy("ribbon")
                .map((v, k) => ({
                    "ribbon": k,
                    "total_e": _(v).total("count")
                }))
                .reverse()
                .value();

            $(toward_data).each((i, o) => {
                $("#select_toward").append('<option value="' + o.ribbon + '">' +
                    o.ribbon.capitalize() +
                    ' - Indirect Donation: ' + format_dollar_select(o.total_e/1E6) + 'M (' + format_pct(o.total_e/total_e) + ')' +
                    '</option>'
                )
            });
        }

        create_selects(choices);
        viz_halo(data, choices);
        viz_bar(data, choices);

        $("#select_office, #select_state, #select_party").change(function() {
            choices.office = $("#select_office").val();
            choices.state  = $("#select_state").val();
            choices.party  = $("#select_party").val();

            //create_selects(choices);
            viz_halo(data, choices);
            viz_bar(data, choices);
        });

        $("#reset").on("click", e => {
            choices = {
                "office": "ALL",
                "state":  "ALL",
                "party":  "ALL"
            };

            create_selects(choices);
        });
    });
});

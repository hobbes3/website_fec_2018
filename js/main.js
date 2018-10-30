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
    var data = {};

    // https://stackoverflow.com/a/49534634/1150923
    var files = ["/data/data.csv"];

    var choices = {
        "office": "ALL",
        "state":  "ALL",
        "party":  "ALL"
    };

    Promise.all(files.map(url => d3.csv(url))).then(function(values) {
        viz_halo(values[0], choices);
        viz_bar(values[0], choices);

        $("#select_office, #select_state, #select_party").change(function() {
            choices.office = $("#select_office").val();
            choices.state  = $("#select_state").val();
            choices.party  = $("#select_party").val();

            viz_halo(values[0], choices);
            viz_bar(values[0], choices);
        });
    });
});

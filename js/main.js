require([
    "jquery",
    "d3",
    "underscore",
    "moment",
    "js/helper",
    "js/halo"
],
function(
    $,
    d3,
    _,
    moment,
    helper,
    halo
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
        halo(values[0], choices);

        $("#select_office, #select_state, #select_party").change(function() {
            choices.office = $("#select_office").val();
            choices.state  = $("#select_state").val();
            choices.party  = $("#select_party").val();

            halo(values[0], choices);
        });
    });
});

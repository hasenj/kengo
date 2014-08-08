define(function(require) {
    var ko = require('knockout');
    require('knockout.mapping');
    require('knockout.punches');
    ko.punches.enableAll();

    var u = require('lodash');
    var req = require('request');

    var Application = function() {
        var self = this;
        self.test = "if you see this, binding is ok!";
        req.get("/remember.json").then(function(data) {
            console.log("Got data for rememner:", data);
        });
    };
    var app = new Application();

    ko.applyBindings(app, document.querySelector('#app-container'));
});

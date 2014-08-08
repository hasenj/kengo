define(function(require) {
    var ko = require('knockout');
    require('knockout.mapping');
    require('knockout.punches');
    ko.punches.enableAll();

    var u = require('lodash');
    var req = require('request');

    var Application = function() {
        var self = this;
        self.lesson = ko.observable(null);
        self.error = ko.observable(null);
        self.loading = ko.observable(false);

        self.loadLesson = function(name) {
            self.loading(true); // XXX find a way to bind loading indicator to a promise?
            req.get("/" + name + ".json").then(function(data) {
                self.loading(false);
                self.error(null);
                self.lesson(new Lesson(data));
            }).catch(function(error) {
                self.loading(false);
                self.error(error);
            });
        }

    };

    var Lesson = function(data) {
        var self = this;
        // XXX for now assume video ..
        self.video_source = ko.observable("/" + data.media);
        self.title = ko.observable(data.title);
    };

    var app = new Application();

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the test lesson
    app.loadLesson("remember");
    window.app = app;
});

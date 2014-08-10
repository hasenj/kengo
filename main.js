define(function(require) {
    var ko = require('knockout');
    require('knockout.mapping');
    require('knockout.punches');
    ko.punches.enableAll();

    require('kobindings');

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
                self.lesson(null);
                self.loading(false);
                self.error(error.message);
            });
        }

    };

    // proxy
    // useful for passing constructors to u.map
    var ctor_fn = function(ctor) {
        return function() {
            var object = Object.create(ctor.prototype);
            ctor.apply(object, arguments);
            return object;
        }
    }

    var is_initialized = function(value) {
        return (typeof value !== "undefined" && value !== null);
    }

    // similar to observable, but can't be changed once initialized!
    var constant = function(init) {
        var value = ko.observable(init);
        return ko.computed({
            read: function() {
                return value();
            },
            write: function(nv) {
                if(is_initialized(value())) {
                    throw "Can't initialize constant twice!";
                } else {
                    value(nv);
                }
            }
        });
    }

    // a function to return a promise for when an observable become non-undefined and non-null
    // but without guarantee that it won't become undefined or null again!
    var after_init = function(observable) {
        return new Promise(function(resolve, reject) {
            var value = observable();
            if(is_initialized(value)) {
                resolve(true);
            } else {
                var sub = observable.subscribe(function(value) {
                    if(is_initialized(value)) {
                        sub.dispose();
                        resolve(true);
                    }
                });
            }
        });
    }

    var Lesson = function(data) {
        var self = this;
        // XXX for now assume video ..
        self.video_source = ko.observable("/" + data.media);
        self.title = ko.observable(data.title);

        self.video_element = constant(null);
        after_init(self.video_element).then(function() {
            console.log("Video Element has initialized");
        });

        var lesson = self;
        var Section = function(data) { // ctor
            var self = this;
            self.time = ko.observable(data.time); // XXX parse the time!
            self.text = ko.observable(data.text);

            var section = self;
            var SectionNote = function(data) { // ctor
                var self = this;
                self.text = ko.observable(data);
            }

            self.notes = ko.observableArray(u.map(data.notes, ctor_fn(SectionNote)));
        }

        self.sections = ko.observableArray(u.map(data.text_segments, ctor_fn(Section)));
        self.current_section = ko.observable(null);
    };

    var app = new Application();
    window.app = app;

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the test lesson
    app.loadLesson("remember");
});

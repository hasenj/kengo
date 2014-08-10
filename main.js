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

    // from http://stackoverflow.com/a/10073788/35364
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    // parse a mm:ss.xx type of timestamp into a number that represents seconds
    // rules:
    //  mm:ss is interpreted so that mm is minutes and ss is seconds. ss can contain a dot, i.e. ss.xx
    //  if there's no mm: then the number is interprested as seconds
    // also: assumes "ts" is a string, not a number
    var parse_ts = function(ts) {
        if(ts.indexOf(":") == -1) {
            return Number(ts);
        } else {
            var parts = ts.split(":");
            var mm = parts.shift();
            var ss = parts.shift();
            return Number(mm) * 60 + Number(ss);
        }
    }

    // display seconds (number) as a mm:ss.xxx timestamp
    var as_ts = function(time) {
        var minutes = Math.floor(time / 60);
        var seconds = Math.floor(time % 60);
        var ms = time - Math.floor(time);
        return "" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + ms.toFixed(3).slice(2);
    }

    ko.filters.as_timestamp = function(seconds) {
        return as_ts(ko.unwrap(seconds));
    }

    var Lesson = function(data) {
        var self = this;
        // XXX for now assume video ..
        self.video_source = ko.observable("/" + data.media);
        self.title = ko.observable(data.title);

        self.video_element = constant(null);
        self.currentTime = ko.observable(null);
        self.video_peek_mode = ko.observable(false);
        self.video_stop_time = ko.observable(null);
        self.video_controls = ko.computed(function() {
            if(self.video_peek_mode()) {
                return false;
            }
            return true;
        });
        self.video_paused = ko.observable(true);
        self.video_playing = ko.computed(function() {
            return !self.video_paused();
        });

        // video management .. "think" function for video player
        after_init(self.video_element).then(function() {
            var element = self.video_element();
            console.log("Video Element has initialized");

            ko.computed(function() {
                element.controls = self.video_controls();
            }, this, { disposeWhenNodeIsRemoved: element });

            // keep the playing observable in sync with the player
            var sync_paused_status = function() {
                self.video_paused(element.paused)
            }
            element.addEventListener("playing", sync_paused_status);
            element.addEventListener("play", sync_paused_status);
            element.addEventListener("pause", sync_paused_status);
            element.addEventListener("ended", sync_paused_status);
            element.addEventListener("seeked", sync_paused_status);
            sync_paused_status();

            var ts_interval = setInterval(function() {
                if(!self.video_peek_mode()) {
                    self.currentTime(element.currentTime);
                }
                if(self.video_stop_time()) {
                    if(element.currentTime >= self.video_stop_time()) {
                        element.pause();
                        self.video_stop_time(null);
                        // end peek mode if it was one
                        if(self.video_peek_mode()) {
                            self.video_peek_mode(false);
                            element.currentTime = self.currentTime();
                        }
                    }
                }
            }, 100);
            // clear this interval when the element is gone
            ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
                console.info("Clearing video tracking interval!");
                clearInterval(ts_interval);
            });
        });

        self.video_peek = function() {
            self.video_peek_mode(true);
            self.video_stop_time(self.currentTime() + 1.5);
            self.video_element().play();
        }

        self.forward_smaller = function() {
            self.video_element().currentTime = self.currentTime() + 0.1;
        }
        self.forward_small = function() {
            self.video_element().currentTime = self.currentTime() + 0.5;
        }
        self.backward_small = function() {
            self.video_element().currentTime = self.currentTime() - 0.5;
        }
        self.backward_smaller = function() {
            self.video_element().currentTime = self.currentTime() - 0.1;
        }

        self.set_section_time_from_video = function() {
            var section = self.current_section();
            if(!section) { return; }
            section.time(self.currentTime());
        }

        var lesson = self;
        var Section = function(data) { // ctor
            var self = this;
            self.time = ko.observable(parse_ts(data.time));
            self.text = ko.observable(data.text);

            var section = self;
            var SectionNote = function(data) { // ctor
                var self = this;
                self.text = ko.observable(data);
            }

            self.notes = ko.observableArray(u.map(data.notes, ctor_fn(SectionNote)));

            // when a user clicks section, seek video to its time
            self.click = function() {
                if(is_initialized(lesson.video_element)) {
                    // if the video is paused, and user selects a section, turn on manual section mode and choose this one
                    if(lesson.video_paused()) {
                        lesson.use_video_section(false);
                    }
                    lesson.user_current_section(self);
                    lesson.video_element().currentTime = self.time();
                }
            }
        }

        // XXX odd naming ..
        self.follow_video = function() {
            self.use_video_section(true);
        }

        self.sections = ko.observableArray(u.map(data.text_segments, ctor_fn(Section)));
        // find the last section whose time is <= currentTime
        self.video_current_section = ko.computed(function() {
            var currentTime = self.currentTime();
            return u.findLast(self.sections(), function(section) {
                return section.time() <= currentTime;
            });
        });
        self.user_current_section = ko.observable(null);
        self.use_video_section = ko.observable(true);
        self.current_section = ko.computed(function() {
            if(self.use_video_section()) {
                return self.video_current_section();
            } else {
                return self.user_current_section();
            }
        });
    };

    var app = new Application();
    window.app = app;

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the test lesson
    app.loadLesson("remember");
});

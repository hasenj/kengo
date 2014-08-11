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

    /**
        json fields:

            "media": url for media
            "text_language": e.g. "japanese",
            "user_language": e.g. "arabic",
            "title": arbitrary string, lesson title
            "text_segments": list of sections. see Section ctor below
     */
    var Lesson = function(data) {
        var self = this;
        // XXX for now assume video ..
        self.video_source = ko.observable("/" + data.media);
        self.title = ko.observable(data.title);

        self.video_element = constant(null);
        self.currentTime = ko.observable(null);
        self.video_peek_mode = ko.observable(false);
        self.video_stop_time = ko.observable(null);
        self.use_video_controls = ko.computed(function() {
            if(self.video_peek_mode()) {
                return false;
            }
            return true;
        });
        self.video_paused = ko.observable(true);
        self.video_playing = ko.computed(function() {
            return !self.video_paused();
        });

        self.video_seek = function(time) {
            self.video_element().currentTime = time;
        }
        self.video_play = function() {
            self.video_element().play();
        }

        // video management .. "think" function for video player
        after_init(self.video_element).then(function() {
            var element = self.video_element();
            console.log("Video Element has initialized");

            ko.computed(function() {
                element.controls = self.use_video_controls();
            }, this, { disposeWhenNodeIsRemoved: element });

            // keep the playing observable in sync with the player
            var sync_paused_status = function() {
                self.video_paused(element.paused || self.video_peek_mode())
            }
            element.addEventListener("playing", sync_paused_status);
            element.addEventListener("play", sync_paused_status);
            element.addEventListener("pause", sync_paused_status);
            element.addEventListener("ended", sync_paused_status);
            element.addEventListener("seeked", sync_paused_status);
            sync_paused_status();

            var cleanup_loop_modes = function() {
                self.video_stop_time(null);
                self.video_peek_mode(false);
            }
            element.addEventListener("pause", cleanup_loop_modes);
            element.addEventListener("seeked", cleanup_loop_modes);
            element.addEventListener("ended", cleanup_loop_modes);

            var ts_interval = setInterval(function() {
                if(!self.video_peek_mode()) {
                    self.currentTime(element.currentTime);
                }
                if(self.video_stop_time()) {
                    if(element.currentTime >= self.video_stop_time()) {
                        element.pause();
                        // cleaning up the stop time is done elsewhere (in
                        // response to pausing, etc) so we don't have to worry
                        // about it here

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

        // see what starts here
        self.video_peek = function() {
            self.video_peek_mode(true);
            self.video_stop_time(self.currentTime() + 0.8);
            self.video_element().play();
        }

        // see what ends here
        self.video_back_peek = function() {
            self.video_peek_mode(true);
            self.video_stop_time(self.currentTime());
            self.video_seek(self.currentTime() - 0.8);
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

        var lesson = self;
        /**
            json fields:

                time: time stamp, e.g. 11:23.2
                text: string
                notes: list of strings (optional)
         */
        var Section = function(data) { // ctor
            var self = this;
            self.time = ko.observable(parse_ts(data.time));
            self.text = ko.observable(data.text);

            self.lesson = lesson; // for templates (views)

            var section = self;
            /**
                json format: string; plain text!
             */
            var SectionNote = function(data) { // ctor
                var self = this;
                self.text = ko.observable(data);

                // SectionNote.export_data
                self.export_data = function() {
                    return self.text();
                }
            }

            self.notes = ko.observableArray(u.map(data.notes, ctor_fn(SectionNote)));

            // when a user clicks section, seek video to its time
            self.click = function() {
                lesson.jump_to_section(self);
            }


            self.use_video_time = function() {
                self.time(lesson.currentTime());
            }
            self.jump_video_to_start = function() {
                lesson.video_seek(self.time());
            }
            self.play_section_only = function() {
                lesson.video_seek(self.time());
                var next = lesson.find_next_section(self);
                if(next) {
                    lesson.video_stop_time(next.time());
                }
                lesson.video_play();
            }


            // Section.export_data
            self.export_data = function() {
                var out = {};
                out.time = as_ts(self.time());
                out.text = self.text();
                if(self.notes().length) {
                    out.notes = u.invoke(self.notes(), 'export_data');
                }
                return out;
            }
        }

        // XXX odd naming ..
        self.follow_video = function() {
            self.use_video_section(true);
        }
        self.video_playing.subscribe(function(yes) {
            if(yes) {
                self.use_video_section(true);
            }
        });

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

        // find section after given one
        self.find_next_section = function(section) {
            if(!section) { return null; }
            var index = u.findIndex(self.sections(), section);
            if(index == -1) { return null; };
            if( (index + 1) < self.sections().length ) {
                return self.sections()[index + 1];
            } else {
                return null;
            }
        }
        // find section preceeding given one
        self.find_prev_section = function(section) {
            if(!section) { return null; }
            var index = u.findIndex(self.sections(), section);
            if(index == -1) { return null };
            if(index > 0) {
                return self.sections()[index - 1];
            } else {
                return null;
            }
        }

        self.jump_to_section = function(section) {
            if(is_initialized(self.video_element)) {
                // if the video is paused, and user selects a section, turn on manual section mode and choose this one
                if(self.video_paused()) {
                    self.use_video_section(false);
                }
                self.user_current_section(section);
                self.video_seek(section.time());
            }
        }

        self.next_section = ko.computed(function() {
            return self.find_next_section(self.current_section());
        });
        self.prev_section = ko.computed(function() {
            return self.find_prev_section(self.current_section());
        });

        self.use_next_section = function() {
            var section = self.next_section();
            if(section) {
                self.jump_to_section(section);
            }
        }
        self.use_prev_section = function() {
            var section = self.prev_section();
            if(section) {
                self.jump_to_section(section);
            }
        }

        // Lesson.export_data
        self.export_data = function() {
            var out = {};
            out.media = data.media; // as-is
            out.text_language = data.text_language;
            out.user_language = data.user_language;
            out.title = self.title();
            out.text_segments = u.invoke(self.sections(), 'export_data');
            return out;
        }

        self.as_json = ko.computed(function() {
            return JSON.stringify(self.export_data(), null, 4);
        });
    };

    var app = new Application();
    window.app = app;

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the test lesson
    app.loadLesson("remember");
});

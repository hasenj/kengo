define(function(require) {
    var ko = require('ko');
    var u = require('lodash');

    var req = require('request');
    var utils = require('utils');
    var video = require('video');
    var furigana = require('furigana')

    // ----- first some helpers -----------

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
        if(!ts) { return null; }
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

    function breaklines(str) {
        return str.replace(new RegExp('\r?\n','g'), '<br />'); // http://stackoverflow.com/a/14369585/35364
    }

    // furigana parsing - attach `to_html` computed to the observable that represents the htmlized version of it!
    // XXX make this choose a different parser depending on the language of the lesson!
    var make_parsable = function(text) {
        text.as_html = ko.computed(function() {
            return breaklines(furigana.to_html(ko.unwrap(text)));
        });
    }

    // ----- the Lesson constructor -------

    /**
        json fields:

            "media": url for media
            "text_language": e.g. "japanese",
            "user_language": e.g. "arabic",
            "title": arbitrary string, lesson title
            "text_segments": list of sections. see Section ctor below
     */
    var Lesson = function(slug, data) {
        var self = this;
        self.hash = ko.observable(data.hash);
        self.backendhash = ko.observable(self.hash());
        self.is_out_of_sync = ko.computed(function() {
            return self.backendhash() != self.hash();
        });
        data = data.lesson; // HACK
        // XXX for now assume the media is always a video source ..
        self.video_source = ko.observable(data.media); // XXX should we make this a constant?!
        self.title = ko.observable(data.title);

        self.video_element = utils.constant(null);
        self.video_time = ko.observable(null);
        self.video_paused = ko.observable(true);
        self.player = null;
        self.furigana_visible = utils.flag(true);
        self.video_visible = utils.flag(true);
        self.video_initialized = utils.wait_for_init(self.video_element).then(function() {
            var element = self.video_element();
            self.player = new video.Player(element);

            // keep our time in sync with player time
            self.player.time.subscribe(function(time) {
                self.video_time(time); // XXX do we even need this as a separate observable?!
            });

            var sync_paused = function(paused) {
                self.video_paused(paused);
            }
            self.player.paused.subscribe(sync_paused);
            sync_paused(self.player.paused());

            console.log("Video Player initialized");
            return true;
        });

        var player_peek = function(start, end, reset) {
            self.player.show_controls(false);
            self.follow_video_blockers.push(1);
            video.player_play_segment(self.player, start, end, reset).then(function(){
                console.log("Segment peek done!");
                self.player.show_controls(true);
                self.follow_video_blockers.pop();
            }).catch(function(error) {
                console.log("Segment peek interrupted!", error);
                self.player.show_controls(true);
                self.follow_video_blockers.pop();
            });
        }

        var peek_duration = 0.8;
        // see what starts here
        self.video_peek = function() {
            var start = self.video_time();
            var end = start + peek_duration;
            var reset = start;
            player_peek(start, end, reset);
        }

        // see what ends here
        self.video_back_peek = function() {
            var end = self.video_time();
            var start = end - peek_duration;
            var reset = end;
            player_peek(start, end, reset);
        }

        self.play_segment = function(start, end) {
            var reset = start;
            return video.player_play_segment(self.player, start, end, reset).then(function(){
                console.log("Segment play done!");
            }).catch(function(error) {
                console.log("Segment play interrupted!", error);
                throw error;
            });
        }


        self.forward_smaller = function() {
            self.player.forward(0.1);
        }
        self.forward_small = function() {
            self.player.forward(0.5);
        }
        self.backward_small = function() {
            self.player.backward(0.5)
        }
        self.backward_smaller = function() {
            self.player.backward(0.1)
        }

        var lesson = self;
        /**
            json fields:

                time: time stamp, e.g. 11:23.2
                text: string
                notes: string (optional)
         */
        var Section = function(data) { // ctor
            var self = this;
            self.time = ko.observable(parse_ts(data.time));
            self.text = ko.observable(data.text);
            make_parsable(self.text);

            self.notes = ko.observable(data.notes || "");
            make_parsable(self.notes);

            self.element = utils.constant(null);

            self.lesson = lesson; // for templates (views)

            // when a user clicks section, seek video to its time
            self.click = function() {
                lesson.jump_to_section(self);
            }

            self.use_video_time = function() {
                self.time(lesson.video_time());
            }
            self.jump_video_to_start = function() {
                lesson.player.seek(self.time());
            }
            self.play_section_only = function() {
                var start = self.time();
                var end;
                var next = lesson.find_next_section(self);
                if(next) {
                    end = next.time();
                } else {
                    end = lesson.player.duration() - 0.1; // hack because reaching the end looks like a pause to the player
                }
                // Prevent selecting next section at the end by turning off video following.
                lesson.follow_video_blockers.push(1);
                lesson.play_segment(start, end).then(function(){
                    console.log("Section play done!");
                    lesson.follow_video_blockers.pop();
                }).catch(function(error) {
                    console.log("Section play interrupted!", error);
                    lesson.follow_video_blockers.pop();
                });
            }

            self.insert_section_at_player_time = function() {
                var time = lesson.player.time();
                lesson.insert_new_section(time);
            }

            // Section.export_data
            self.export_data = function() {
                var out = {};
                out.time = as_ts(self.time());
                out.text = self.text();
                if(self.notes()) {
                    out.notes = self.notes();
                }
                return out;
            }
        }

        self.sections_list = ko.observableArray(utils.ctor_map(data.text_segments, Section));
        self.sections = ko.computed(function() {
            return u.sortBy(self.sections_list(), function(s) { return s.time() });
        });

        // find the last section whose time is <= video_time
        self.find_video_section = function() {
            var video_time = self.video_time();
            return u.findLast(self.sections(), function(section) {
                return section.time() <= video_time;
            });
        };
        self.current_section = ko.observable(null).extend({ notify_strict: true });
        // we wish to give other components the ability to temporarily block following video
        // so we must first build a list of video blockers that can be removed!
        self.follow_video_blockers = ko.observableArray();
        self.following_video = ko.computed(function() {
            return (self.follow_video_blockers().length === 0 && !self.video_paused()) || !self.current_section();
        });
        ko.computed(function() {
            if(self.following_video()) {
                self.current_section(self.find_video_section());
            }
        });

        self.current_section_element = ko.computed(function() {
            var s = self.current_section();
            if(!s) { return null; }
            return s.element();
        });
        self.auto_scroll = utils.flag(true);

        var get_scrolling_element = u.once(function() {
            var original = window.scrollY;
            var test_target = 100;
            if(test_target == original) {
                test_target = 50;
            }
            var element = null;
            // do a test scroll
            window.scrollTo(0, 100);
            if(document.body.scrollTop == test_target) {
                element = document.body;
            }
            if(document.documentElement.scrollTop == test_target) {
                element = document.documentElement;
            }
            window.scrollTo(0, original); // restore
            return element;
        });

        // auto scroll!
        self.current_section_element.subscribe(function(element) {
            if(!element) { return; }
            if(self.auto_scroll.is_off()) { return; }

            function scroll_by(shift) {
                var cont = get_scrolling_element();
                var target = cont.scrollTop + shift;
                var duration = Math.abs(shift) * 3; // 3 seconds per 1000 pixels
                duration = Math.min(duration, 600);
                utils.smooth_scroll_to(cont, target, duration).then(function() {
                    console.log("Scrolling done");
                }).catch(function(e){
                    console.log("Scrolling aborted:", e);
                });
            }

            var rect = element.getBoundingClientRect();
            var offset_to_bottom = window.innerHeight - rect.bottom;
            var offset_to_top = rect.top;
            // console.log("offset to bottom:", offset_to_bottom);
            // console.log("offset to top:", offset_to_top);

            var top_threshold = 40; // topbar, etc

            // enforce some minimum bottom offset
            var bottom_threshold = 150;
            // if we're too low, bring it to almost near the top
            var target_bottom_offset = Math.round(window.innerHeight * 0.75); // the value we want for the bottom offset
            var target_top_offset = 80;
            var top_shift = offset_to_top - target_top_offset;
            var bottom_shift = target_bottom_offset - offset_to_bottom;
            if(offset_to_bottom < bottom_threshold) {
                // we want to use bottom_shift, but make sure not to make the
                // top value too small!
                var shift = Math.min(bottom_shift, top_shift);
                scroll_by(shift);
            }
            if(offset_to_top < top_threshold) {
                scroll_by(top_shift);
            }

        });

        // debug
        if(false) {
            utils.invoke(function() { // IIFE
                var previous_section = self.current_section();
                self.current_section.subscribe(function(section) {
                    // console.log("New section .. are they equal?", section === previous_section);
                    previous_section = section;
                });
            });
        }

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
            if(utils.is_initialized(self.video_element)) {
                self.current_section(section);
                self.player.seek(section.time());
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

        self.insert_section_at_player_time = function() {
            var time = self.player.time();
            self.insert_new_section(time);
        }
        self.insert_new_section = function(time) {
            // find the index where must insert this new section
            var new_section = new Section({time: as_ts(time), text: "", notes: ""});
            self.sections_list.push(new_section);
            self.jump_to_section(new_section);
            self.note_edit_mode.turn_on();
        }

        self.note_edit_mode = utils.flag(false);
        // when the current section changes, turn off edit mode!
        self.current_section.subscribe(function() {
            self.note_edit_mode.turn_off();
        });
        self.enter_note_edit_mode = function() {
            self.note_edit_mode.turn_on();
        }
        self.leave_note_edit_mode = function() {
            self.note_edit_mode.toggle();
        }
        self.note_edit_mode.subscribe(function(yes) {
            // XXX assuming the first call will always be a "yes" ..
            // because we don't want to pop something that someone else pushed!!
            if(yes) {
                self.follow_video_blockers.push(1);
            } else {
                self.follow_video_blockers.pop();
            }
        });

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

        self.saving = ko.observable(false);
        self.saved = ko.observable(false);
        self.last_saved = ko.observable(Date.now());
        self.saved.subscribe(function(yes) { // everytime we save, listen to changes and unset the flag!
            if(yes) {
                // XXX this will glitch if edits were made before the save completed?!
                // XXX compare against self.last_saved_data()
                var change = self.as_json.subscribe(function() {
                    self.saved(false);
                    change.dispose();
                });
            }
        });
        self.saved(true); // start saved

        self.last_saved_data = ko.observable(null);
        var _save = function(method, data) {
            var url = "/api/lesson/" + slug;
            self.saving(true);
            self.saved(true); // be optimistic!
            return req.request(method, url, {}, data).then(function(response) {
                // update hash
                self.hash(response.hash);
                self.backendhash(response.hash);

                self.saving(false);
                self.last_saved(Date.now());
                self.last_saved_data(data);
            }).catch(function(error) {
                self.saving(false);
                self.saved(false); // our optimism was wrong!
                throw error.response;
            });
        }
        self.save = function() {
            var data = {
                hash: self.hash(),
                lesson: self.export_data()
            }
            return _save("put", data);
        }
        self.create = function() { // like save, put for first time creation: uses POST, and doesn't send a hash
            var data = {
                lesson: self.export_data()
            }
            return _save("post", data);
        }
        self.save_enabled = ko.computed(function() {
            return !self.saving() && !self.saved();
        });
        self.save_text = ko.computed(function() {
            if(self.save_enabled()) {
                return "Save";
            }
            if(self.saving()) {
                return "Saving ..";
            }
            if(self.saved()) {
                return "Saved!";
            }
            return "Save"; // defaule
        });

        self.last_hash_check = ko.observable(Date.now());
        self.check_hash = function() {
            if(self.is_out_of_sync()) {
                return Promise.reject("Already out of sync");
            }
            setTimeout(self.check_hash, 30 * 1000)
            var url = "/api/lesson_hash/" + slug;
            return req.get(url).then(function(response) {
                self.last_hash_check(Date.now());
                self.backendhash(response.hash);
            });
        }
        setTimeout(self.check_hash, 30 * 1000);

        self.reload = function() {
            // XXX check for the existence of unsaved edits, and warn user if so!
            var lesson_url = "/api/lesson/" + slug;
            return req.get(lesson_url).then(function(data) {
                // return new Lesson(slug, data);
                // update the lesson!
                self.hash(data.hash);
                self.backendhash(self.hash());
                data = data.lesson; // HACK
                // the section list can be completely rebuilt - nothing special there
                self.title(data.title);
                self.sections_list(utils.ctor_map(data.text_segments, Section));
                // hack - force current section to be recalculated
                // this is a hack because it should be more automatic
                self.current_section(null);
                // don't update the media - it might fuck around with the player and the media element and all that shit!
                return true;
            });
        }

    };

    Lesson.load = function(slug) {
        var lesson_url = "/api/lesson/" + slug;
        return req.get(lesson_url).then(function(data) {
            return new Lesson(slug, data);
        });
    }

    return Lesson;
});

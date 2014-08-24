define(function(require) {
    var ko = require('ko');
    var u = require('lodash');

    var video = {};

    // ctor for media player
    // @param element: the html5 video element
    video.Player = function(element) {
        var self = this;
        self.show_controls = ko.observable(true);
        ko.computed(function() {
            element.controls = self.show_controls();
        }, this, { disposeWhenNodeIsRemoved: element });

        self.paused = ko.observable(true);
        self.playing = ko.computed(function() {
            return !self.paused();
        });
        // keep the playing observable in sync with the player
        var sync_paused_status = function() {
            self.paused(element.paused);
        }
        element.addEventListener("playing", sync_paused_status);
        element.addEventListener("play", sync_paused_status);
        element.addEventListener("pause", sync_paused_status);
        element.addEventListener("ended", sync_paused_status);
        element.addEventListener("seeked", sync_paused_status);
        sync_paused_status();

        self.duration = function() {
            return element.duration;
        }

        self.play = function() {
            element.play();
        }
        self.pause = function() {
            element.pause();
        }
        self.toggle_play_pause = function() {
            if(self.paused()) {
                self.play();
            } else {
                self.pause();
            }
        }
        self.seek = function(time) {
            element.currentTime = time;
        }
        self.forward = function(delta) { // seek forward
            element.currentTime += delta;
        }
        self.backward = function(delta) { // seek backward
            element.currentTime -= delta;
        }
        self.time = ko.observable(element.currentTime);
        var ts_interval = setInterval(function() {
            self.time(element.currentTime);
        }, 50);
        // clear this interval when the element is gone
        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            console.info("Clearing video tracking interval!");
            clearInterval(ts_interval);
        });

        // relay events in a more simpler way
        // event_proxy is a subscribable (ko), when you subscribe to it, you get events in the following format:
        //     {
        //         ts: timestamp (mostly for uniquness .. you can ignore)
        //         type: the event type/name; e.g. "play", "paused", etc. Most of the time, this is the most interesting property you want to check
        //         event: the actual event object fired by the browser, in case you need it
        //     }
        self.event_proxy = ko.observable();
        var relay_event = function(event) {
            self.event_proxy({
                ts: Date.now(),
                type: event.type,
                event: event
            });
        }
        element.addEventListener("playing", relay_event);
        element.addEventListener("play", relay_event);
        element.addEventListener("pause", relay_event);
        element.addEventListener("seeked", relay_event);
        element.addEventListener("ended", relay_event);

        // returns a promise that gets fulfilled after the player has sent all events in params
        self.wait_for_events = function() {
            var waiting_for = Array.prototype.slice.call(arguments);
            return new Promise(function(resolve, reject) {
                var sub = self.event_proxy.subscribe(function(ev) {
                    console.log("[PP] Event:", ev.type, "Time:", ev.ts);
                    u.pull(waiting_for, ev.type);
                    if(waiting_for.length == 0) {
                        sub.dispose();
                        resolve(true);
                    }
                });
            });
        }
    }

    /**
        Play from start_time to end_time, and when done, seek the player to reset_to_time

        Returns a promise that's fulfilled when we're done, or rejected if we get interrupted before we reach it!
            done meaning: we reached the end time, and seeked to reset_to_time
     */
    video.player_play_segment = function(player, start_time, end_time, reset_to_time) {
        player.pause();
        player.seek(start_time);
        player.play();
        return new Promise(function(resolve, reject) {
            // wait for the playing event, then start listening to one of "seeked ended paused" event
            player.wait_for_events("playing", "seeked").then(function() {
                // XXX there must be a better way to know if the promise has been fulfilled or not!
                var done = false; // keep track if we're done before trying to reject!
                var time_sub = player.time.subscribe(function(time) {
                    if(done) {
                        time_sub.dispose();
                        return;
                    }
                    if(time >= end_time) {
                        done = true;
                        player.pause();
                        player.seek(reset_to_time);
                        time_sub.dispose();
                        // waiting for seeking to finish before resolving
                        player.wait_for_events("seeked").then(function() {
                            resolve(true);
                        });
                    }
                });
                var interruption_sub = player.event_proxy.subscribe(function(ev) {
                    console.log("[IS] Event:", ev.type, "Time:", ev.ts);
                    if(done) {
                        interruption_sub.dispose();
                        return;
                    }
                    if(u.contains("pause seeked".split(" "), ev.type)) { // interruption!!
                        done = true;
                        reject(ev.type);
                    }
                });
            });
        });
    }

    return video;
});

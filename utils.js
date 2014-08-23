define(function(require) {
    var ko = require('ko');
    var u = require('lodash');

    var utils = {};

    // to make IIFE's more readable
    utils.invoke = function(fn) {
        fn();
    }

    /**
        Observable used as a boolean flag
        with helpers:
            .turn_on
            .turn_off
            .toggle
            .is_on (sort of redundant! but always returns Boolean)
            .is_off
     */
    utils.flag = function(init) {
        var value = ko.observable(Boolean(init));
        value.turn_on = function() {
            value(true);
        }
        value.turn_off = function() {
            value(false);
        }
        value.is_on = ko.computed(function() {
            return Boolean(value());
        });
        value.is_off = ko.computed(function() {
            return !value.is_on();
        });
        value.toggle = function() {
            value(!value());
        }
        return value;
    };

    // an observable that can't be changed once initialized!
    utils.constant = function(init) {
        var value = ko.observable(init);
        return ko.computed({
            read: function() {
                return value();
            },
            write: function(nv) {
                if(utils.is_initialized(value())) {
                    throw "Can't initialize constant twice!";
                } else {
                    value(nv);
                }
            }
        });
    }


    // Take a constructor and return a function that can be called without new
    // but have the same effect as calling the constructor with new.
    // Useful for passing constructors to u.map
    utils.ctor_fn = function(ctor) {
        return function() {
            var object = Object.create(ctor.prototype);
            ctor.apply(object, arguments);
            return object;
        }
    }

    utils.ctor_map = function(list, ctor) {
        return u.map(list, utils.ctor_fn(ctor));
    }

    utils.is_initialized = function(value) {
        return (typeof value !== "undefined" && value !== null);
    }

    /**
        Return a promise when an observable gets initialized, meaning, it gets assigned a value other than null and undefined.

        Needless to say, there's no guarantee that it won't become undefined or null again in the future
     */
    utils.wait_for_init = function(observable) {
        return new Promise(function(resolve, reject) {
            var value = observable();
            if(utils.is_initialized(value)) {
                resolve(true);
            } else {
                var sub = observable.subscribe(function(value) {
                    if(utils.is_initialized(value)) {
                        sub.dispose();
                        resolve(true);
                    }
                });
            }
        });
    }

    /**
        Smoothly scroll element to the given target (element.scrollTop) for the given duration

        Returns a promise that's fulfilled when done, or rejected if interrupted
     */
    utils.smooth_scroll_to = function(element, target, duration) {
        target = Math.round(target);
        duration = Math.round(duration);
        // console.log("scrolling to target:", target);
        if (duration < 0) {
            return Promise.reject("bad duration");
        }
        if (duration === 0) {
            element.scrollTop = target;
            return Promise.resolve();
        }

        var start_time = Date.now();
        var end_time = start_time + duration;

        var start_top = element.scrollTop;
        var difference = target - start_top;

        // based on http://en.wikipedia.org/wiki/Smoothstep
        var smooth_step = function(start, end, point) {
            if(point <= start) { return 0; }
            if(point >= end) { return 1; }
            var x = (point - start) / (end - start); // interpolation
            return x*x*(3 - 2*x);
            // return x*x*x*(x*(x*6 - 15) + 10);
        }

        return new Promise(function(resolve, reject) {

            var previous_top = element.scrollTop;

            var scroll_frame = function() {
                if(element.scrollTop != previous_top) {
                    console.log("animation interrupted; aborting");
                    reject("interrupted");
                    return;
                }
                var now = Date.now();
                // debugger;
                var point = smooth_step(start_time, end_time, now);
                // console.log("point now is:", point);
                var frame_target = Math.round(start_top + (difference * point));
                frame_target = Math.min(target, frame_target); // don't allow it to go past target
                // console.log("scrolling to:", frame_target);
                element.scrollTop = frame_target;

                if(now >= end_time) {
                    console.log("time over - done");
                    resolve();
                    return;
                }

                // if we were supposed to scroll but didn't ..
                if(element.scrollTop === previous_top && element.scrollTop !== frame_target) {
                    // didn't go through - we probably hit the limit
                    // consider it done instead of interrupted
                    console.log("Expected:", frame_target, "but found:", previous_top);
                    console.log("didn't go through - assuming done!");
                    resolve();
                    return;
                }
                previous_top = element.scrollTop;

                if (element.scrollTop > target) { // shouldn't happen - but for completeness
                    console.log("scroll top > target");
                    element.scrollTop = target;
                    resolve();
                    return;
                }
                if (element.scrollTop === target) {
                    resolve();
                    return;
                }
                setTimeout(scroll_frame, 0); // tick
            }
            setTimeout(scroll_frame, 0);
        });
    }


    return utils;
});

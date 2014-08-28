define(function(require) {
    var ko = require('ko');
    var u = require('lodash');

    var utils = {};

    // to make IIFE's more readable
    utils.invoke = function(fn) {
        fn();
    }

    utils.is_on = function(v) {
        return Boolean(v);
    }
    utils.is_off = function(v) {
        return !utils.is_on(v);
    }
    /**
        Observable used as a boolean flag
        with helpers:
            .turn_on
            .turn_off
            .toggle
            .is_on (sort of redundant! but always returns Boolean)
            .is_off
            .wait_for_on // returns a promise
            .wait_for_off // returns a promise
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
            return utils.is_on(value());
        });
        value.is_off = ko.computed(function() {
            return utils.is_off(value());
        });
        value.toggle = function() {
            value(!value());
        }
        // @param timeout: a canceller timeout. see utils.wait_for
        value.wait_for_on = function(timeout) {
            return utils.wait_for(value, utils.is_on, timeout);
        }
        // @param timeout: a canceller timeout. see utils.wait_for
        value.wait_for_off = function(timeout) {
            return utils.wait_for(value, utils.is_off, timeout);
        }
        return value;
    };

    utils.wait_timeout = function(timeout) {
        return new Promise(function(resolve, reject) {
            setTimeout(resolve, timeout);
        });
    }

    // promise that resolves when observable gets value
    // the value can optionally be a function that takes a value and returns true or false
    // with an optional timeout
    // timeout is either a number, in which case it's just a timeout ..
    // or a promise object. When the promise is fullfilled (or timeout passes), the promise is reject; i.e. the wait is aborted!
    utils.wait_for = function(observable, value, timeout) {
        var value_check = function() {
            return observable() == value;
        }
        if(u.isFunction(value)) {
            value_check = value;
        }

        if(value_check(observable())) {
            return Promise.resolve(value());
        }
        return new Promise(function(resolve, reject) {
            var sub = observable.subscribe(function(nv) {
                if(value_check(nv)) {
                    sub.dispose(); // idempotent
                    resolve()
                }
            });
            if(utils.is_initialized(timeout)) {
                if(u.isNumber(timeout)) {
                    timeout = utils.wait_timeout(timeout); // convert it to a promise!
                }
                timeout.then(function() {
                    sub.dispose(); // idempotent!
                    reject("timeout promise"); // rejecting when already resolved should be safe
                });
            }
        });
    }

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
                    // console.log("animation interrupted; aborting");
                    reject("interrupted");
                    return;
                }
                var now = Date.now();
                var point = smooth_step(start_time, end_time, now); // point is clamped to [0-1]
                // console.log("point now is:", point);
                var frame_target = Math.round(start_top + (difference * point));
                // console.log("scrolling to:", frame_target);
                element.scrollTop = frame_target;

                if(now >= end_time) {
                    // console.log("time over - done");
                    resolve();
                    return;
                }

                // if we were supposed to scroll but didn't ..
                if(element.scrollTop === previous_top && element.scrollTop !== frame_target) {
                    // didn't go through - we probably hit the limit
                    // consider it done instead of interrupted
                    // console.log("Expected:", frame_target, "but found:", previous_top);
                    // console.log("didn't go through - assuming done!");
                    resolve();
                    return;
                }
                previous_top = element.scrollTop;

                setTimeout(scroll_frame, 0); // tick
            }
            setTimeout(scroll_frame, 0);
        });
    }


    return utils;
});

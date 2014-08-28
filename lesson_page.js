define(function(require) {
    var ko = require('ko');
    var utils = require('utils');
    var sio = require('socket-io');
    var shortcuts = require('shortcuts');
    var app_shell = require('app_shell');

    var Lesson = require('lesson');

    var socket_connected = utils.flag(false);
    var socket = sio.connect(); // no need for any parameters - defaults work!
    socket.on('connect', socket_connected.turn_on);
    socket.on('disconnect', socket_connected.turn_off);

    function LessonPage() {
        var self = this;
        self.lesson = ko.observable(null);
        self.app_shell = app_shell;

        self.slug = ko.observable(null);
        var lesson_changed_handler = function(slug) {
            console.log("changed event!", slug);
            if(self.lesson()) {
                self.lesson().check_hash();
            }
        }

        self.activate = function(slug) {
            Lesson.load(slug).then(function(lesson) {
                shortcuts.setupLessonShortcuts(lesson);
                self.lesson(lesson);
            });
            self.slug(slug);
            // on activate, join socket room for lesson,
            socket_connected.wait_for_on().then(function() {
                console.log("socket on management");
                socket.emit('watch', slug);

                // make sure we only subscribe once!
                socket.on('changed', lesson_changed_handler);
            });
            // somehow, make sure to rewatch slug if connection is lost then re-established!
        }

        self.deactivate = function() {
            var slug = self.slug();
            self.slug(null);
            console.log("socket off management - part 1");
            socket.removeListener('changed', lesson_changed_handler);
            // leave the 'room'; stop watching this slug for changes
            // we have to check the connection is on first ..
            var rejoined = utils.wait_for(self.slug, slug);
            // make the promise reject if we reload the same lesson while this thing is still waiting!
            // the parameter passed to wait_for_on is a canceller promise!
            // (the part about the canceller is not really tested!)
            socket_connected.wait_for_on(rejoined).then(function() {
                console.log("socket off management - part 2");
                socket.emit('watch_end', slug);
            }).catch(function(error) {
                console.log("looks like we rejoined!!", error);
            });
        }
    }
    return LessonPage;
});

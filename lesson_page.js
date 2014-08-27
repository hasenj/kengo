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

        self.slug = null;
        self.lesson_changed_handler = function(slug) {
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
            self.slug = slug;
            // on activate, join socket room for lesson,
            // XXX on deactivate, leave that room
            socket_connected.wait_for_on().then(function() {
                console.log("socket on management");
                socket.emit('watch', slug);

                // make sure we only subscribe once!
                // socket.off('changed', self.lesson_changed_handler);
                socket.on('changed', self.lesson_changed_handler);
            });
        }

        self.deactivate = function() {
            console.log("Deactivating!!!!");
            var slug = self.slug;
            self.slug = null;
            socket_connected.wait_for_on().then(function() {
                console.log("socket off management");
                socket.emit('watch_end', slug);
                socket.off('changed');
            });
        }
    }
    return LessonPage;
});

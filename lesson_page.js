define(function(require) {
    var ko = require("ko");
    var shortcuts = require('shortcuts');
    var app_shell = require('app_shell');

    var Lesson = require("lesson");

    function LessonPage() {
        var self = this;
        self.lesson = ko.observable(null);
        self.app_shell = app_shell;
        self.activate = function(slug) {
            Lesson.load(slug).then(function(lesson) {
                shortcuts.setupLessonShortcuts(lesson);
                self.lesson(lesson);
            });
        }
    }
    return LessonPage;
});

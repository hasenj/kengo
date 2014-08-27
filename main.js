define(function(require) {
    var ko = require('ko');
    var u = require('lodash');

    var req = require('request');
    var utils = require('utils');
    var shortcuts = require('shortcuts');

    var Lesson = require('lesson');

    var Application = function() {
        var self = this;
        self.lesson = ko.observable(null);
        self.error = ko.observable(null);
        self.loading_items = ko.observableArray();
        self.loading = ko.computed(function() {
            self.loading_items().length > 0;
        });

        self.loadLesson = function(lesson_slug) {
            self.loading_items.push(1); // XXX find a way to bind loading indicator to a promise?
            Lesson.load(lesson_slug).then(function(lesson) {
                self.loading_items.pop();
                self.error(null);
                self.lesson(lesson);
                self.item(lesson); // set as the page item!
                shortcuts.setupLessonShortcuts(self.lesson());
            }).catch(function(error) {
                self.loading_items.pop();
                self.lesson(null);
                self.error(error.message);
            });
        }

        // show a page for creating a new lesson
        self.newLesson = function() {
            self.item(new CreateLessonPage(self));
        }

        self.loadLessonList = function() {
            self.loading_items.push(1);
            req.get("/api/lessons").then(function(data) {
                self.item(new LessonListPage(self, data));
                self.loading_items.pop();
            }).catch(function(error) {
                self.loading_items.pop();
            });
        }

        self.item = ko.observable();
    };



    var app = new Application();
    window.app = app;

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the lesson list
    app.loadLessonList();
});

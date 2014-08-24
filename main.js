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
            var lesson_url = "/api/lesson/" + lesson_slug;
            req.get(lesson_url).then(function(data) {
                self.loading_items.pop();
                self.error(null);
                self.lesson(new Lesson(lesson_slug, data));
                self.item(self.lesson()); // set as the page item!
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

    var CreateLessonPage = function(app) {
        var self = this;
        self.template_name = "new_lesson_template";
        self.slug = ko.observable("");
        self.title = ko.observable("");
        self.media = ko.observable("");
        self.text_language = ko.observable("japanese");
        self.user_language = ko.observable("arabic");
        self.error = ko.observable("");

        self.start = function() {
            self.error("");
            var lesson = new Lesson(self.slug(), self.export_data());
            // try to save the lesson first
            lesson.create().then(function() {
                app.lesson(lesson);
                app.item(lesson);
            }).catch(function(error) {
                var friendly_message = "Creating lesson failed: ["+ error.error + "] " + error.message;
                console.error(friendly_message);
                self.error(friendly_message);
            });
        }

        // CreateLessonPage.export_data
        self.export_data = function() {
            var out = {};
            out.media = self.media();
            out.title = self.title();
            out.text_language = self.text_language();
            out.user_language = self.user_language();
            out.text_segments = [{time: "00:00", text: ""}];
            return out;
        }
    }

    var LessonListPage = function(app, data) {
        var self = this;
        self.template_name = "lesson_list_template";

        var LessonEntry = function(data) {
            var self = this;
            self.title = ko.observable(data.title);
            self.load = function() {
                app.loadLesson(data.slug);
            }
        }

        self.lessons = ko.observableArray(utils.ctor_map(data.lessons, LessonEntry));
    }


    var app = new Application();
    window.app = app;

    ko.applyBindings(app, document.querySelector('#app-container'));

    // initialize the page with the lesson list
    app.loadLessonList();
});

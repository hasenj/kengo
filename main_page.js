define(function(require) {
    var ko = require("ko");
    var req = require("request");
    var utils = require("utils");
    var app_shell = require('app_shell');

    var LessonListPage = function() {
        var self = this;
        self.viewUrl = "main_page.html";
        self.app_shell = app_shell;

        var LessonEntry = function(data) {
            var self = this;
            self.title = ko.observable(data.title);
            self.load = function() {
                app_shell.loadLesson(data.slug);
            }
            self.selected = utils.flag(false);
            self.hovered = utils.flag(true);
        };

        // XXX consider assuming a thumbnail .. for example:
        // self.thumbnail = computed: video url - extention + '_thumb.jpg'
        // or maybe the backend should generate it at the moment of creation of
        // a lesson and then save the url for it in the lesson data

        self.lessons = ko.observableArray();
        self.lessons.loading = utils.flag(false);
        self.update = function(data) {
            self.lessons(utils.ctor_map(data.lessons, LessonEntry));
        };

        self.edit_mode = utils.flag(false);

        self.activate = function() {
            console.log("Activating main page");
            self.lessons.loading(true);
            req.get("/api/lessons").then(function(data) {
                self.update(data);
                self.lessons.loading(false);
            }).catch(function(error) {
                self.lessons.loading(false);
                // throw error;
                // XXX show an error or something!
                app_shell.error(error);
            });
        };
    }

    return LessonListPage;
});

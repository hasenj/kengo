define(function(require) {
    var ko = require('ko');
    var app_shell = require('app_shell');
    var Lesson = require('lesson');

    var CreateLessonPage = function() {
        var self = this;
        self.viewUrl = "new_lesson_page.html";
        self.slug = ko.observable("");
        self.title = ko.observable("");
        self.media = ko.observable("");
        self.text_language = ko.observable("japanese");
        self.user_language = ko.observable("arabic");
        self.error = ko.observable("");

        self.start = function() {
            self.error("");
            var slug = self.slug();
            var data = self.export_data();
            var lesson = new Lesson(slug, data);
            // try to save the lesson first
            lesson.create().then(function() {
                app_shell.loadLesson(slug);
            }).catch(function(error) {
                var friendly_message = "Creating lesson failed: ["+ error.error + "] " + error.message;
                console.error(friendly_message);
                self.error(friendly_message);
            });
        }
        self.cancel = function() {
            app_shell.loadLessonList();
        }

        // CreateLessonPage.export_data
        self.export_data = function() {
            var data = {};
            data.media = self.media();
            data.title = self.title();
            data.text_language = self.text_language();
            data.user_language = self.user_language();
            data.text_segments = [{time: "00:00", text: ""}];
            return { lesson: data };
        }
    }
    return CreateLessonPage;
});

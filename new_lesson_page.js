define(function(require) {
    var ko = require('ko');
    var app_shell = require('app_shell');

    var CreateLessonPage = function(app) {
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
        self.cancel = function() {
            app_shell.loadLessonList();
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
    return CreateLessonPage;
});

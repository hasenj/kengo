define(function(require) {
    var ko = require("ko");
    var req = require("request");
    var utils = require("utils");
    var app_shell = require('app_shell');
    var dialog = require('plugins/dialog');

    var LessonListPage = function() {
        var self = this;
        self.viewUrl = "main_page.html";
        self.app_shell = app_shell;

        self.lessons = ko.observableArray();
        self.lessons.loading = utils.flag(false);

        var page = self;
        var LessonEntry = function(data) {
            var self = this;
            self.title = ko.observable(data.title);
            self.slug = utils.constant(data.slug);
            self.load = function() {
                app_shell.loadLesson(data.slug);
            }
            self.disabled = utils.flag(false);
            self.hovered = utils.flag(true);
            self.working = utils.flag(false);

            self.test_delete_ui = function() {
                self.working(true);
                self.disabled(true);
                utils.wait_timeout(500).then(function() {
                    self.lessons.remove(self);
                });
            }

            // show a popup dialog to confirm
            self.delete_lesson = function() {
                var lesson = self;
                var Dialog = function LessonDeleteConfirmDialog() { // ctor
                    var self = utils.create(LessonDeleteConfirmDialog);
                    self.viewUrl = "lesson_delete_confirmation.html";

                    self.lesson_title = utils.read_only(lesson.title);
                    self.lesson_slug = lesson.slug;

                    self.required_confirmation = "delete " + self.lesson_slug();
                    self.confirmation_input = ko.observable("");
                    self.is_confirmation_valid = ko.computed(function() {
                        return self.confirmation_input() == self.required_confirmation;
                    });

                    self.accept_confirmation = function() {
                        if(!self.is_confirmation_valid()) { // sanity check!
                            return;
                        }
                        dialog.close(self, true);
                    }

                    self.cancel = function() {
                        // XXX it's cruical that the second parameter here is
                        // false! otherwise lesson will be deleted!
                        // Somehow I don't like how an important piece of
                        // functionality is a bit not-so-obvious
                        dialog.close(self, false);
                    }

                    return self;
                }

                var confirmation_dialog = Dialog();
                dialog.show(confirmation_dialog).then(function(yes) {
                    if(yes) {
                        // do the actual deletion!
                        self.disabled(true);
                        self.working(true);
                        // even if delete request returns quickly, we will wait at least one second
                        var waiting = utils.wait_timeout(1000);
                        var url = "/api/lesson/" + self.slug();
                        req.del(url).then(function() {
                            waiting.then(function() {
                                page.lessons.remove(self);
                                // now self should not exist anywhere in the app
                                // XXX do we somehow need to mark it as destroyed or something?!
                            });
                        }).catch(function() {
                            self.working(false);
                            self.disabled(false);
                            alert("Deletion failed!!");
                        });
                    } else {
                        // nothing to do
                        // console.log("cancelled; won't delete lesson");
                    }
                });
            }
        };

        // XXX consider assuming a thumbnail .. for example:
        // self.thumbnail = computed: video url - extention + '_thumb.jpg'
        // or maybe the backend should generate it at the moment of creation of
        // a lesson and then save the url for it in the lesson data

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

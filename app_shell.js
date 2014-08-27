define(function(require) {
    var ko = require("ko");
    var router = require('plugins/router');

    function AppShell() {
        var self = this;
        self.viewUrl = 'app_shell.html';
        self.error = ko.observable(null);
        self.router = router;

        self.activate = function() {
            router.map([
                {
                    route: '',
                    moduleId: 'main_page', // lesson listing, etc
                    title: 'Main Page',
                },
                {
                    route: 'new',
                    moduleId: 'new_lesson_page',
                    title: 'Create A Lesson',
                },
                {
                    route: 'lesson/:slug',
                    moduleId: 'lesson_page',
                    title: 'Lesson', // page should change the title!
                }
            ]);

            return router.activate();
        }

        self.loadLesson = function(slug) {
            router.navigate('lesson/' + slug);
        }
        self.loadLessonList = function() {
            router.navigate('');
        }
        self.newLesson = function() {
            router.navigate('new');
        }

    }

    return new AppShell();
});

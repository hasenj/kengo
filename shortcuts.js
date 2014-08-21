define(function(require) {
    var mousetrap = require('mousetrap');

    mousetrap.stopCallback = function(e, element, combo) {
        // if the element has the class "mousetrap" then no need to stop
        if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
            return false;
        }

        // if cmd/ctrl/alt keys are pressed, then let the shortcut go through even if it's inside a textarea
        var special_keys = e.ctrlKey || e.metaKey || e.altKey;
        if(special_keys) {
            return false;
        }

        // stop for input, select, and textarea
        return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || (element.contentEditable && element.contentEditable == 'true');
    }

    function setupLessonShortcuts(lesson) {
        mousetrap.reset();

        // toggle video play
        mousetrap.bind(['space', 'mod+p'], function() {
            lesson.player.toggle_play_pause();
            return false; // stop browser default action
        });

        mousetrap.bind([',', 'mod+,'], function() {
            lesson.player.pause();
            lesson.backward_small();
        });
        mousetrap.bind(['<', 'mod+<'], function() {
            lesson.player.pause();
            lesson.backward_smaller();
        });
        mousetrap.bind(['.', 'mod+.'], function() {
            lesson.player.pause();
            lesson.forward_small();
        });
        mousetrap.bind(['>', 'mod+>'], function() {
            lesson.player.pause();
            lesson.forward_smaller();
        });

        mousetrap.bind(['/', 'mod+/'], function() {
            if(lesson.player.playing()) {
                // video must be paused for this shortcut/action
                return false;
            }
            lesson.video_peek();
        });
        mousetrap.bind(['?', 'mod+?'], function() {
            if(lesson.player.playing()) {
                // video must be paused for this shortcut/action
                return false;
            }
            lesson.video_back_peek();
        });

        mousetrap.bind(['n', 'mod+n'], function() {
            if(lesson.player.playing()) {
                // video must be paused for this shortcut/action
                return false;
            }
            lesson.insert_section_at_player_time();
        });

        mousetrap.bind('mod+s', function() {
            lesson.save();
        });
    }

    return {
        setupLessonShortcuts: setupLessonShortcuts
    }
});

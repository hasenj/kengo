/**
    Utility for detecting when the user leaves this page and comes back to it

    There's a visibility API but it only seems to work when the user switches to another tab within the browser! It does not work when the user leaves the browser completely!

    On the other hand, there's a window focus and blur events, but they don't seem to work when the user switches to another tab within the current browser.

    So, this utility object brings these two mechanisms together to provide a uniform streamlined API for detecting whether the user is viewing this page or not.
 */
define(function(require) {
    var focus = {};

    // from the mozilla wiki
    // Set the name of the hidden property and the change event for visibility
    var hidden, visibilityChange;
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
        hidden = "hidden";
        visibilityChange = "visibilitychange";
    } else if (typeof document.mozHidden !== "undefined") {
        hidden = "mozHidden";
        visibilityChange = "mozvisibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
        hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
        hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }

    // our flag!
    focus.page_has_focus = ko.observable();

    focus.checkFocus = function() {
        var docFocused = document.hasFocus();
        var pageVisible = !document[hidden];

        // update our main flag
        focus.page_has_focus(pageVisible && docFocused);
        return focus.page_has_focus();
    }

    document.addEventListener(visibilityChange, focus.checkFocus);
    window.addEventListener("focus", focus.checkFocus);
    window.addEventListener("blur", focus.checkFocus);

    document.onreadystatechange = focus.checkFocus;

    return focus;
});

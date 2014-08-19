// This is meant to initialize ko and its extensions
define(function(require) {
    var ko = require('knockout');
    require('knockout.mapping');
    require('knockout.punches');
    require('knockout-switch-case');
    ko.punches.enableAll();

    // data-bind="element: observable"
    // sets observable to element ..
    ko.bindingHandlers.element = {
        init: function (element, valueAccessor) {
            var target = valueAccessor();
            try {
                target(element);
            } catch(e) {
                console.error("element binding not used properly: target setting failed with error:\n", e);
            }
        }
    };

    // prevent computed/observable update notification when it's the same object (but not native object)
    ko.extenders.notify_strict = function(target, yes) {
        var strict_equality = function(a, b) {
            return a === b;
        };

        if(yes) {
            target["equalityComparer"] = strict_equality;
        }

        //return the original observable
        return target;
    };

    // binding to make textarea autoresize
    // based on: http://stackoverflow.com/a/5346855/35364 (also: http://jsfiddle.net/hmelenok/WM6Gq/ )
    // usage:
    //  <textarea data-bind="...., textarea_autosize: ob"> ....
    // The parameter passed is optional, if observable, it's subscribed to and
    // used to trigger resize event.  It should be an observable that's related
    // to the visibility of the textarea, since the computation will fail if
    // the element is hidden
    ko.bindingHandlers.textarea_autosize = {
        init: function(element, valueAccessor) {
            var resize = function() {
                element.style.height = 'auto';
                element.style.height = element.scrollHeight+'px';
            };
            element.addEventListener('input', resize);
            element.addEventListener('change', resize);
            resize();
            var ob = valueAccessor();
            if(ko.isObservable(ob)) {
                var sub = ob.subscribe(resize);
                // clear that when element is gone!
                ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
                    sub.dispose();
                });
            }
        }
    }

    return ko;
});

define(function(require) {
    var ko = require('knockout');

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

});

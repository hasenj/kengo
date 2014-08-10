define(function(require) {
    var ko = require('knockout');

    // data-bind="element: observable"
    // sets observable to element ..
    ko.bindingHandlers.element = {
        init: function (element, valueAccessor) {
            var target = valueAccessor();
            if (ko.isObservable(target)) {
                target(element);
            } else {
                throw "element binding not used properly";
            }
        }
    };

});

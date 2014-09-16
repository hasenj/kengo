define(function(require) {
    var ko = require("ko");
    var u = require("lodash");
    var utils = require("utils");
    var composition = require('durandal/composition');

    var clicked_element = ko.observable();
    document.addEventListener("click", function(event) {
        // XXX what if some other handler stops the propagation before it gets
        // to the document?!
        clicked_element(event.target);
    });

    var menu = Object.create({}); // module ..

    /**
     */
    menu.Menu = function Menu(items) {
        var self = utils.create(menu.Menu);

        self.viewUrl = "menu.html";

        self.menu_element = utils.constant();
        self.items = ko.observableArray(items);

        // will be used to track clicks outisde menu element and trigger element
        var close_sub = null;
        var close_sub_dispose = function() {
            if(close_sub) {
                close_sub.dispose();
            }
        }

        utils.invoke(function init() { // IIFE
            if(self.menu_element()) {
                return; // idempotency!
            }

            var menu_element = document.createElement("div");
            menu_element.classList.add("menu_host"); // necessary for css goodies
            composition.compose(menu_element, {
                model: self,
                transition: false,
                activate: false, // XXX why?! (copied from dialog)
            });

            // dispose the close_sub when menu_element is gone
            ko.utils.domNodeDisposal.addDisposeCallback(menu_element, close_sub_dispose);

            self.menu_element(menu_element);
        });

        /**
            Open menu because it got triggered by @param trigger_element
         */
        self.open = function(trigger_element) {
            // position menu next to trigger
            var menu_element = self.menu_element();
            // XXX naive positioning!
            menu_element.style.top = trigger_element.offsetTop + "px";
            menu_element.style.left = (trigger_element.offsetLeft + trigger_element.offsetWidth) + "px";

            // show the menu element
            document.body.appendChild(self.menu_element());

            // close menu when clicking outisde!
            close_sub = clicked_element.subscribe(function(clicked) {
                if(trigger_element.contains(clicked)) {
                    return;
                }
                if(self.menu_element().contains(clicked)) {
                    return;
                }

                self.close();
            });
        }

        self.close = function() {
            document.body.removeChild(self.menu_element());

            // clean up click-outisde listener ..
            close_sub_dispose();
        }

        self.item_click_handler = function(item) {
            return function() {
                self.close();
                utils.invoke(ko.unwrap(item.callback));
            }
        }

        return self;
    }

    menu.MenuItem = function MenuItem(label, callback) {
        var self = utils.create(menu.MenuItem);
        callback = callback || function() {};

        self.text = ko.observable(label);
        self.callback = ko.observable(callback);
        self.hovered = utils.flag(false);
        return self;
    }

    menu.CreateMenu = function(raw_items) {
        var items = u.map(raw_items, function(data) {
            return menu.MenuItem(data.label, data.callback);
        });
        return menu.Menu(items);
    }

    return menu;
});

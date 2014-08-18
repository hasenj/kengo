define(function(require) {
    var u = require('lodash');

    /**
        Rules:

            KANJI[HIRA｜GANA]

        We count how many characters the furigana covers, then apply it on `count` kanji character backwards
        hiragana readings include | to separate kanji segments, and this tells us how many kanji characters!
     */
    function FuriganaParser(furigana_start, furigana_split, furigana_end) {
        var self = this;

        // XXX TODO make it tokenize text first, so that \[ gets ignored!
        function Iterator(text) {
            var self = this;
            var cursor = 0;
            self.peek = function(length) {
                length = length || 1;
                return text.substr(cursor, length);
            }
            self.consume = function(length) {
                length = length || 1;
                var ret = text.substr(cursor, length);
                cursor += length;
                return ret;
            }
            // look for c, and tell how many steps to get there
            self.find = function(c) {
                var steps = 0;
                while(true) {
                    if(cursor + steps > text.length) {
                        return -1;
                    }
                    if(text[cursor + steps] == c) {
                        return steps;
                    }
                    steps++;
                }
            }

            self.ended = function() {
                return cursor >= text.length;
            }
        }

        /**
            Return a list of furigana segments (array of strings)
         */
        function grab_ruby(iter) {
            if(iter.consume() !== furigana_start) {
                throw "Parser error: grab_ruby called with cursor not on a '[' character";
            }
            var len = iter.find(furigana_end);
            if(len == -1) {
                throw "Parser Error: Malformed string"
            }
            var ruby = iter.consume(len);
            if(iter.consume() !== furigana_end) {
                throw "Parser error: find did not return proper length!";
            }
            return ruby.split(furigana_split);
        }

        // convert plain text to a more complicated data structure: an array of arrays of
        //     { text, ruby }
        // where ruby is optional
        self.parse = function(text) {

            // given a list of kanji and ruby, zip them into a list of { text, ruby } objects
            var items = function(kanji, ruby) {
                var result = [];
                for(var i = 0; i < kanji.length; i++) {
                    var object = { text: kanji[i] };
                    if(i < ruby.length) {
                        object.ruby = ruby[i];
                    }
                    result.push(object);
                }
                return result;
            }

            var result = [];
            var waiting = []; // a line for text(s) waiting for their ruby
            var iter = new Iterator(text);
            while(true) {
                if(iter.ended()) {
                    if(waiting.length) {
                        result.push(items(waiting, []));
                    }
                    return result;
                }
                if(iter.peek() == furigana_start) {
                    var ruby = grab_ruby(iter);
                    var boundary = waiting.length - ruby.length;
                    if(boundary < 0) {
                        throw "Malformed string: more furigana parts than kanji!"
                    }
                    var text = waiting.slice(0, boundary);
                    if(text.length) {
                        result.push(items(text, []));
                    }
                    // zip together the ruby with the remaining waiting items
                    var kanji = waiting.slice(boundary);
                    result.push(items(kanji, ruby));
                    waiting = []; // reset waiting items
                } else {
                    waiting.push(iter.consume());
                }
            }
        }

        self.to_html = function(text) {
            try {
                return to_html(text, self);
            } catch(e) {
                return text;
            }
        }

    }

    var parser = new FuriganaParser("【", "・", "】");

    // some tests!!
    function test_parser(text) {
        console.log("Parsing:", text);
        try {
            console.log(JSON.stringify(parser.parse(text), null, 4));
        } catch(e) {
            console.log(e);
        }
    }

    test_parser("hello");
    test_parser("隣【となり】");
    test_parser("大学【だい・がく】");
    test_parser("この大学【だい・がく】");
    test_parser("学【が・く】"); // malformed

    var to_html = function(text, parser, use_collapse) {
        var parse = parser.parse(text);
        var collapse_group = function(group) {
            return u.reduce(group, function(item, item2) {
                var text = item.text + item2.text;
                var ruby;
                if(item.ruby && item2.ruby) {
                    ruby = item.ruby + item2.ruby;
                }
                return { text: text, ruby: ruby }
            });
        }
        var item_html = function(item) {
            if(item.ruby) {
                return "<ruby>" + item.text + "<rp>(</rp>" + "<rt>" + item.ruby + "</rt>" + "<rp>)</rp>" + "</ruby>";
            } else {
                return item.text;
            }
        }
        var html_parts = u.map(parse, function(group) {
            if(use_collapse) {
                var item = collapse_group(group);
                return item_html(item);
            } else {
                return u.map(group, function(item) {
                    return item_html(item);
                }).join("");
            }
        });
        return html_parts.join("");
    }

    function test_conversion(text, use_collapse) {
        console.log("Converting:", text, use_collapse? "with collapsed furigana" : "");
        console.log(to_html(text, parser, use_collapse));
    }

    console.log("\n\nTesting html conversion\n-------------------------------------");
    test_conversion("hello");
    test_conversion("隣【となり】");
    test_conversion("大学【だい・がく】");
    test_conversion("hello\nこの大学【だい・がく】");
    test_conversion("hello\nこの大学【だい・がく】", true);
    // test_conversion("学【が・く】"); // malformed

    return parser;
});

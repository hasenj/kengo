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

        // convert plain text to a more complicated data structure: an array of
        //     { char, ruby }
        // where ruby is optional
        self.parse = function(text) {

            // given a list of kanji and ruby, zip them into a list of { char, ruby } objects
            var items = function(kanji, ruby) {
                var result = [];
                for(var i = 0; i < kanji.length; i++) {
                    var object = { char: kanji[i] };
                    if(i < ruby.length) {
                        object.ruby = ruby[i];
                    }
                    result.push(object);
                }
                return result;
            }

            var result = [];
            var waiting = []; // a line for chars waiting for their ruby
            var iter = new Iterator(text);
            while(true) {
                if(iter.ended()) {
                    result = result.concat(items(waiting, []));
                    return result;
                }
                if(iter.peek() == furigana_start) {
                    var ruby = grab_ruby(iter);
                    var boundary = waiting.length - ruby.length;
                    if(boundary < 0) {
                        throw "Malformed string: more furigana chars than kanji!"
                    }
                    var chars = waiting.slice(0, boundary);
                    result = result.concat(items(chars, []));
                    // zip together the ruby with the remaining waiting items
                    var kanji = waiting.slice(boundary);
                    result = result.concat(items(kanji, ruby));
                    waiting = []; // reset waiting items
                } else {
                    waiting.push(iter.consume());
                }
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


    return parser;
});

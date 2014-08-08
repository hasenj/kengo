define(function(require) {
    var AsyncRequest = XMLHttpRequest;

    // takes a dict and returns a string "a=b&c=d"
    var toUrlParams = function(dict) {
        var res = [];
        for(var key in dict) {
            var value = encodeURIComponent(dict[key])
            res.push(key + "=" + value);
        }
        return res.join("&");
    }

    // takes a path and a params dict and returns a string "/path/?param1=val1&param2=val2"
    var makeUrl = function(path, params) {
        var params = toUrlParams(params);
        if(params) {
            return path + "?" + params;
        } else {
            return path;
        }
    }

    // get the hostname from a url/path the same way that the hostname is extracted from the location in window.href.hostname
    // from: http://stackoverflow.com/a/8498668/35364
    var pathHost = function(url) {
        var a = document.createElement('a');
        a.href = url;
        return a.hostname;
    }

    // constructor
    var JsonRequest = function(pmethod, ppath) {
        var self = this;
        var method = pmethod.toUpperCase();
        var path = ppath;
        var data = {};
        var params = {};
        var headers = [];

        // this one is a getter only!
        self.path = function() {
            return path;
        }
        // ditto
        self.method = function() {
            return method;
        }

        // the rest are only setters
        self.header = function(key, value) {
            var h = {key: key, value: value};
            headers.push(h);
            return self;
        }

        self.data = function(pdata) {
            data = pdata;
            return self;
        }

        self.params = function(pparams) {
            params = pparams;
            return self;
        }

        // this one doesn't chain; it returns a promise!
        self.send = function() {
            // XXX this part is off for now - make it an event of some kind!
            // call before_send hooks
            // we must call it here before we start building the request and setting headers, etc
            // because these hooks are meant for addings headers, etc
            // call(before_hooks, self, [self]);

            var areq = new AsyncRequest();
            var url = makeUrl(path, params);
            areq.open(method, url);

            // force json
            areq.setRequestHeader("Content-Type", "application/json");
            // set the ajax header
            areq.setRequestHeader("X-Requested-With", "XMLHttpRequest");

            // set headers
            // Traverse the headers list by the order of insertion
            // Note: Do this after forcing the json header so that users can override it
            for(var i = 0; i < headers.length; i++) {
                var header = headers[i];
                areq.setRequestHeader(header.key, header.value)
            }

            return new Promise(function(resolve, reject) {
                var json_data = JSON.stringify(data);
                areq.send(json_data);
                areq.onreadystatechange = function() {
                    if(areq.readyState == areq.DONE) {
                        try {
                            var json_response = JSON.parse(areq.responseText);
                        } catch(e) {
                            reject({response_text: areq.responseText});
                            return;
                        }
                        if(areq.status == 200) {
                            resolve(json_response);
                        } else {
                            reject(json_response);
                        }
                    }
                }
            });
        }

        // utilities/helpers

        /// Check if the path is going to a different domain
        self.isCrossOrigin = function() {
            if(path.charAt(0) === "/" && path.charAt(1) !== "/") {
                return false;
            }
            // path has a domain; check if it's different from current domain
            if(pathHost(path) == window.location.hostname) {
                return false;
            }

            // has a host but not the same as this one; so it's cross-domain
            return true;
        }

        self.isSameOrigin = function() {
            return !self.isCrossOrigin();
        }
    }

    // helpers to quickly get a promise ...
    JsonRequest.request = function(method, path, data) {
        var req = new JsonRequest(method, path);
        if(data) {
            req.data(data);
        }
        return req.send();
    }

    JsonRequest.get = function(path, data) {
        return JsonRequest.request("get", path, data);
    }

    JsonRequest.post = function(path, data) {
        return JsonRequest.request("post", path, data);
    }

    JsonRequest.put = function(path, data) {
        return JsonRequest.request("put", path, data);
    }

    JsonRequest.del = function(path, data) {
        return JsonRequest.request("delete", path, data);
    }

    return JsonRequest;
});

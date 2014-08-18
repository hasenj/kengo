import flask
app = flask.Flask(__name__)

import os, itertools, json, codecs

def get_file_ext(filename):
    return os.path.splitext(filename)[1]

def is_json_file(filename):
    return os.path.isfile(filename) and get_file_ext(filename) == ".json"

def find_files(dirname):
    """like os.listdir, but keeps the full path"""
    return (os.path.join(dirname, filename) for filename in os.listdir(dirname))

def filtered_listing(dirname, filter_fn):
    return itertools.ifilter(filter_fn, find_files(dirname))

def slug_from_file(filename):
    base = os.path.basename(filename)
    return os.path.splitext(base)[0]

def read_json_file(filename):
    with open(filename) as fp:
        return json.load(fp)

def lesson_data(filename):
    """Read file as json, extract data, and return it as a dict"""
    data = read_json_file(filename)
    return dict(slug=slug_from_file(filename), title=data['title'])

@app.route("/api/lessons")
def list_lessons():
    """Find a list of json files in the lessons directory"""
    lessons = list(filtered_listing("lessons", is_json_file))
    lessons = map(lesson_data, lessons)
    return flask.jsonify(lessons=lessons)

def error_response(status_code, error_message, error_code=""):
    """Shortcut to return json error responses"""
    resp = flask.jsonify(dict(message=error_message, error=error_code))
    resp.status_code = status_code
    return resp

@app.route("/api/lesson/<slug>", methods=['PUT', 'GET', 'POST'])
def lesson_resource(slug):
    request = flask.request
    if request.method == "GET":
        return get_lesson(slug)
    if request.method == "PUT":
        return put_lesson(slug, request.json)
    if request.method == "POST":
        # for post, make sure the lesson doesn't already exist
        filename = os.path.join("lessons", slug + ".json")
        if os.path.isfile(filename):
            return error_response(401, "slug already exists", "file-exists")
        else:
            return put_lesson(slug, request.json)


def get_lesson(slug):
    filename = os.path.join("lessons", slug + ".json")
    # XXX handle error case if file doesn't exist!
    # XXX also maybe do security to ensure people can't put `..` and so on!!
    # XXX or actually it doesn't matter much since this is only temporary - until we get a real database
    lesson = read_json_file(filename)
    return flask.jsonify(**lesson)

def put_lesson(slug, data):
    filename = os.path.join("lessons", slug + ".json")
    # XXX see notes inside get_lesson
    with codecs.open(filename, 'w', 'utf8') as fp:
        json.dump(data, fp, indent=4, separators=(',', ': '), ensure_ascii=False)
    return flask.jsonify()

if __name__ == "__main__":
    app.run(debug=True, port=10110)

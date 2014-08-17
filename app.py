import flask
app = flask.Flask(__name__)

import os, itertools, json

def get_file_ext(filename):
    return os.path.splitext(filename)[1]

def is_json_file(filename):
    return os.path.isfile(filename) and get_file_ext(filename) == ".json"

def find_files(path):
    """like os.listdir, but keeps the full path"""
    return (os.path.join(path, f) for f in os.listdir(path))

def filtered_listing(path, filter_fn):
    return itertools.ifilter(filter_fn, find_files(path))

def file_url(file):
    return "/" + file; # HACK

def lesson_data(file):
    """Read file as json, extract data, and return it as a dict"""
    data = {}
    with open(file) as f:
        data = json.load(f)
    return dict(url=file_url(file), title=data['title'])

@app.route("/api/lessons")
def list_lessons():
    """Find a list of json files in the lessons directory"""
    lessons = list(filtered_listing("lessons", is_json_file))
    lessons = map(lesson_data, lessons)
    return flask.jsonify(lessons=lessons)

if __name__ == "__main__":
    app.run(debug=True, port=10110)

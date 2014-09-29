import flask
import flask.ext.socketio as socketio
app = flask.Flask(__name__)
socket_server = socketio.SocketIO(app)

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


import hashlib
def filehash(filename, block_size=256*128):
    """
        Get the hash for a file at the given path
        The hash is a sha512 hash
        Based on http://stackoverflow.com/a/17782753/35364
    """
    hash = hashlib.sha512()
    with open(filename, 'rb') as fp:
        for chunk in iter(lambda: fp.read(block_size), b''):
            hash.update(chunk)
    return hash.hexdigest()


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

def lesson_filename(slug):
    # XXX maybe do security to ensure people can't put `..` and so on!!
    # XXX or actually it doesn't matter much since this is only temporary - until we get a real database
    return os.path.join("lessons", slug + ".json")

@app.route("/api/lesson_hash/<slug>", methods=['GET'])
def lesson_hash(slug):
    hash = filehash(lesson_filename(slug))
    return flask.jsonify(hash=hash)

@app.route("/api/lesson/<slug>", methods=['PUT', 'GET', 'POST', 'DELETE'])
def lesson_resource(slug):
    request = flask.request
    if request.method == "GET":
        return get_lesson(slug)
    if request.method == "PUT":
        # for PUT, make sure the hashes match
        filename = lesson_filename(slug)
        if(filehash(filename) != request.json['hash']):
            return error_response(401, "Your version is out of date!", "hash-mismatch")
        return save_lesson(slug, request.json['lesson'])
    if request.method == "POST":
        # for post, make sure the lesson doesn't already exist
        filename = lesson_filename(slug)
        if os.path.isfile(filename):
            return error_response(401, "slug already exists", "file-exists")
        else:
            return save_lesson(slug, request.json['lesson'])
    if request.method == "DELETE":
        # XXX check the user has permission to delete this lesson!!!
        filename = lesson_filename(slug)
        if not os.path.isfile(filename):
            return error_response(400, "no such lesson", "file-not-exists")
        return delete_lesson(slug)


def get_lesson(slug):
    # XXX handle error case if file doesn't exist?!
    filename = lesson_filename(slug)
    lesson = read_json_file(filename)
    hash = filehash(filename)
    return flask.jsonify(hash=hash, lesson=lesson)

def save_lesson(slug, lesson_data):
    filename = lesson_filename(slug)
    with codecs.open(filename, 'w', 'utf8') as fp:
        json.dump(lesson_data, fp, indent=4, separators=(',', ': '), ensure_ascii=False)
    newhash = filehash(filename)

    # This should be try-catch maybe? we don't want this to break the save ..
    # XXX should we force this to be delayed somehow? we want to report successful save to the saver before notifying it!
    socket_server.emit('changed', room=slug)

    return flask.jsonify(hash=newhash)

def delete_lesson(slug):
    # XXX check the user has permission to delete this lesson!!!
    filename = lesson_filename(slug)
    os.remove(filename)
    return flask.jsonify(ok=True)

@socket_server.on('watch')
def on_watch(slug):
    print "Someone is watching:", slug
    socketio.join_room(slug)

@socket_server.on('watch_end')
def on_watch(slug):
    print "Someone stopped watching:", slug
    socketio.leave_room(slug)


if __name__ == "__main__":
    app.debug = True
    socket_server.run(app, port=10110)

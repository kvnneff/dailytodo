var Emitter = require('component/emitter');
var uid = require('matthewmueller/uid');
var Todo;

Todo = function Todo(attrs) {
    if (!(this instanceof Todo)) return new Todo(attrs);
    this._id = attrs._id || uid();
    this.complete = attrs.complete || false;
    this.title = attrs.title || '';
    this.timestamp = new Date().getTime();
};

Emitter(Todo.prototype);

Todo.prototype.attrs = function attrs() {
    var props = {};
    if (this._id) props._id = this._id;
    if (this._rev !== -1) props._rev = this._rev;
    props.complete = this.complete;
    props.title = this.title;
    return props;
};

Todo.prototype.set = function set(attrs) {
    for (key in attrs) {
        this[key] = attrs[key];
        this.emit('change');
        this.emit('change ' + key, this[key]);
    };
};

Todo.prototype.get = function get(attr) {
    return this[attr];
};

module.exports = Todo;
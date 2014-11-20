'use strict';
var PouchDB = require('pouchdb/pouchdb@3.1.0');
var Emitter = require('component/emitter');
var uid = require('matthewmueller/uid');
var Todo = require('./lib/todo');
var List;
var db;

db = new PouchDB('daily_todo_lists');

function isToday(td) {
    var d = new Date();
    if (isNaN(td.getTime())) return false;
    return td.getDate() == d.getDate() && td.getMonth() == d.getMonth() && td.getFullYear() == d.getFullYear();
};

function isYesterday(yd) {
    var y = new Date();
    y.setDate(y.getDate()-1);
    return yd.getDate() == y.getDate() && yd.getMonth() == y.getMonth() && yd.getFullYear() == y.getFullYear();
};

List = function List(attrs) {
    if (!(this instanceof List)) return new List(attrs);
    attrs = attrs || {};
    var self = this;
    var tmpTodos = attrs.todos || [];
    this._id = attrs._id || uid();
    this._rev = attrs._rev || -1;
    this.timestamp = attrs.timestamp ? new Date(attrs.timestamp) : new Date();
    this.todos = [];
    tmpTodos.forEach(function (todo, index) {
        self.createTodo(todo);
    });
};

Emitter(List.prototype);

List.all = function all() {
    var self = this;
    var collection = [];
    db.allDocs({include_docs: true}, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length) {
            res.rows.forEach(function (row) {
                collection.push(new List(row));
            });
        }
        return cb(collection);
    });
};

List.today = function today(cb) {
    db.query(function (doc, emit) {
        if (isToday(new Date(doc.timestamp))) {
            emit(doc);
        }
    }, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length <= 0) return cb(null, List());
        return cb(null, List(res.rows[0].key));
    });
};

List.yesterday = function yesterday(cb) {
    db.query(function (doc, emit) {
        if (isYesterday(new Date(doc.timestamp))) {
            emit(doc);
        }
    }, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length <= 0) return cb(null, new List());
        return cb(null, new List(res.rows[0].key));
    });
};

List.prototype.attrs = function attrs() {
    var props = {};
    if (this._id) props._id = this._id;
    if (this._rev !== -1) props._rev = this._rev;
    props.timestamp = this.timestamp;
    props.todos = [];
    this.todos.forEach(function (todo) {
        props.todos.push(todo.attrs());
    });
    return props;
};

List.prototype.save = function save(cb) {
    var self = this;
    db.put(this.attrs(), function (err, doc) {
        if (err && cb) return cb(err);
        if (err) throw err;
        self._rev = doc.rev;
        if (cb) return cb();
    });
};

List.prototype.remove = function remove(cb) {
    db.remove(this.attrs(), function (err, res) {
        if (err) throw err;
        if (cb) return cb(null, res);
    });
};


List.prototype.createTodo = function createTodo(attrs) {
    var self = this;
    var todo = new Todo(attrs);
    todo.on('change', function (prop, val) {
        self.emit('change todo', todo, prop, val);
    });

    todo.on('destroy', function () {
        var todo = this;
        var index = self.todos.indexOf(todo);
        self.todos.splice(index, 1);
        self.save();
    });
    this.todos.push(todo);
    this.emit('create todo', todo);
};

List.prototype.removeTodo = function removeTodo(_id) {
    var self = this;
    this.todos.forEach(function (todo, index) {
        if (todo._id === _id) {
            self.todos.splice(index, 1);
            self.emit('remove todo', todo);
        }
    });
};

module.exports = List;
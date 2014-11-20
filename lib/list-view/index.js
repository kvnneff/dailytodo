'use strict';
var Emitter = require('component/emitter');
var month = require('anthonyshort/date-month');
var suffixed = require('anthonyshort/date-suffix');
var move = require('visionmedia/move.js');
var domify = require('component/domify');
var template = require('./template.html');
var TodoView = require('./lib/todo-view');
var ListView;

ListView = function ListView(model) {
    if (!(this instanceof ListView)) return new ListView(model);
    var self = this;
    this.model = model;
    this.el = domify(template);
    this.listEl = this.el.querySelector('.List-todos');
    this.todoViews = [];
    this.createTitle();

    this.model.todos.forEach(function (todo) {
        self.createTodo(todo);
    });

    this.model.on('create todo', function (todo) {
        self.createTodo(todo);
    });
};

Emitter(ListView.prototype);

ListView.prototype.createTitle = function createTitle() {
    console.log(this.model.timestamp.getMonth());
    var titleEl = this.el.querySelector('.List-title');
    var titleMonth = month(this.model.timestamp).full();
    var titleSuffixed =  suffixed(this.model.timestamp);
    titleEl.innerHTML = titleMonth + ' ' + titleSuffixed;
};

ListView.prototype.createTodo = function createTodo(todo) {
    var view = TodoView(todo);
    this.todoViews.push(view);
    this.listEl.appendChild(view.el);
    view.el.style.display = 'none';
    view.el.style.display = 'block';
    move(view.el).y(1000).end();
    move(view.el).y(0).end();
};

ListView.prototype.filter = function filter(key, val) {
    this.todoViews.forEach(function (view) {
        if (view.model[key] === val) return view.show();
        view.hide();
    });
};

module.exports = ListView;
'use strict';
var assert = require('component/assert');
var month = require('anthonyshort/date-month');
var suffixed = require('anthonyshort/date-suffix');
var classes = require('component/classes');
var ListView = require('../lib/list-view');
var List = require('../lib/list');

describe('ListView', function () {
    it('returns a new view', function () {
        var list = List();
        var view = ListView(list);
        assert(view !== ListView(list));
    });
    it('creates title element on initialization', function () {
        var list = List();
        var view = ListView(list);
        var elMonth = month(list.timestamp).full();
        var elSuffixed = suffixed(list.timestamp);
        var titleText = view.el.querySelector('.List-title').innerHTML;
        assert(titleText === elMonth + ' ' + elSuffixed);
    });
    it('creates todo elements on initialization', function () {
        var list = List();
        list.createTodo({title: 'Foo'});
        list.createTodo({title: 'Bar'});
        list.createTodo({title: 'Baz'});
        var view = ListView(list);
        assert(view.todoViews.length === 3);
        assert(view.listEl.children.length === 3);
    });
    it('creates todo elements when model emits `create todo`', function () {
        var list = List();
        var view = ListView(list);
        list.createTodo({title: 'Foo'});
        assert(view.todoViews.length === 1);
        assert(view.listEl.children.length === 1);
        assert(view.listEl.querySelector('.Todo-title').innerHTML === 'Foo');
    });
});

describe('ListView#filter', function() {
    it('adds u-hidden class to filtered todo elements', function () {
        var list = List();
        var view = ListView(list);
        list.createTodo({title: 'Foo', complete: false});
        list.createTodo({title: 'Bar', complete: true});
        view.filter('complete', true);
        assert(view.listEl.children[0].classList.contains('u-hidden'));
        assert(!(view.listEl.children[1].classList.contains('u-hidden')));
    });
});
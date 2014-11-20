var assert = require('component/assert');
var List = require('./');

describe('List', function () {
    it('returns a new list', function () {
        var list = List();
        assert(list !== List());
    });
});

describe('List#createTodo', function () {
    it('creates a new todo', function () {
        var list = List();
        list.createTodo({title: 'Foo'});
        assert(list.todos[0].title === 'Foo');
    });
});

describe('List#removeTodo', function () {
    it('removes a todo', function () {
        var list = List();
        list.createTodo({title: 'Foo'});
        assert(list.todos[0].title === 'Foo');
        list.removeTodo(list.todos[0]._id);
        assert(list.todos.length === 0);
    });
});

describe('List#attrs', function () {
    it('returns the list\'s attributes', function () {
        var list = List();
        list.createTodo({title: 'Foo'});
        assert(list.attrs()._id === list._id);
    });
});

describe('List.today()', function () {
    it('returns today\'s list', function () {
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate()-1);
        var list1 = List();
        var list2 = List();
        list1.createTodo({title: 'Foo'});
        list2.createTodo({title: 'Bar'});
        list1.save();
        list2.timestamp = yesterday;
        list2.save();
        List.today(function (err, list) {
            assert(err === null);
            assert(list.todos.length === 1);
            assert(list.todos[0].title === 'Foo');
        });
    });
});

describe('List.yesterday()', function () {
    it('returns yesterday\'s list', function () {
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate()-1);
        var list1 = List();
        var list2 = List();
        list1.createTodo({title: 'Foo'});
        list2.createTodo({title: 'Bar'});
        list1.save();
        list2.timestamp = yesterday;
        list2.save();
        List.yesterday(function (err, list) {
            assert(err === null);
            assert(list.todos.length === 1);
            assert(list.todos[0].title === 'Bar');
        });
    });
});
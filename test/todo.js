var assert = require('component/assert');
var Todo = require('/lib/list/lib/todo');

describe('Todo', function () {
    it('returns a new todo', function () {
        var todo = Todo();
        assert(todo !== Todo());
    });
});

describe('Todo#attrs', function () {
    it('returns the attributes of the todo', function () {
        var todo = Todo({title: 'Foo'});
        assert(todo.attrs().title === 'Foo');
    });
});

describe('Todo#set', function () {
    it('sets a property on the todo', function () {
        var todo = Todo();
        assert(todo.complete === false);
        todo.set({complete: true});
        assert(todo.complete === true);
    });
});

describe('Todo#get', function () {
    it('gets a property on the todo', function () {
        var todo = Todo();
        assert(todo.get('complete') === false);
        todo.set({complete: true});
        assert(todo.get('complete') === true);
    });
});
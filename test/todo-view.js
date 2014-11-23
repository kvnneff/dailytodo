var assert = require('component/assert');
var View = require('/lib/list-view/lib/todo-view');
var Todo = require('/lib/list/lib/todo');

describe('TodoView', function () {
    it('returns a new view', function () {
        var todo = Todo();
        var view = View(todo);
        assert(view !== View(todo));
    });
});
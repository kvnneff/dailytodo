var assert = require('component/assert');
var View = require('/lib/list-view/lib/todo-view');
var Todo = require('/lib/list/lib/todo');

describe('TodoView', function () {
    it('returns a new view', function () {
        var todo = Todo();
        var view = View(todo);
        assert(view !== View(todo));
    });
    it('creates todo element', function () {
        var todo = Todo({title: 'Foo'});
        var view = View(todo);
        var title = view.el.querySelector('.Todo-title').innerHTML;
        var checkboxId = view.el.querySelector('[name=complete]').id;
        var labelFor = view.el.querySelector('label').htmlFor;
        assert(title === 'Foo');
        assert(checkboxId === 'todo-' + todo._id);
        assert(labelFor === 'todo-' + todo._id);
    });
});

describe('TodoView#toggleEditing', function () {
    it('sets contenteditable to true', function () {
        var todo = Todo();
        var view = View(todo);
        assert(view.titleEl.contentEditable === 'false');
        view.toggleEditing();
        assert(view.titleEl.contentEditable.toString() === 'true');
    });
    it('adds `is-editing` class to todo element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.titleEl.classList.contains('is-editing')));
        view.toggleEditing();
        assert(view.titleEl.classList.contains('is-editing'));
    });
    it('removes `is-editing` class from todo element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.titleEl.classList.contains('is-editing')));
        view.toggleEditing();
        assert(view.titleEl.classList.contains('is-editing'));
        view.toggleEditing();
        assert(!(view.titleEl.classList.contains('is-editing')));
    });
});

describe('TodoView#toggleComplete', function () {
    it('toggles model\'s `complete` property', function () {
        var todo = Todo();
        var view = View(todo);
        assert(view.model.get('complete') === false);
        view.checkboxEl.checked = true;
        view.toggleComplete();
        assert(view.model.get('complete') === true);
    });
    it('adds `complete` class to element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.el.classList.contains('complete')));
        view.checkboxEl.checked = true;
        view.toggleComplete();
        assert(view.el.classList.contains('complete'));
    });
    it('removes `complete` class from element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.el.classList.contains('complete')));
        view.checkboxEl.checked = true;
        view.toggleComplete();
        assert(view.el.classList.contains('complete'));
        view.checkboxEl.checked = false;
        view.toggleComplete();
        assert(!(view.el.classList.contains('complete')));
    });
});

describe('TodoView#hide', function () {
    it('adds `hidden` class to todo element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.el.classList.contains('hidden')));
        view.hide();
        assert(view.el.classList.contains('hidden'));
    });
});

describe('TodoView#show', function () {
    it('removes `hidden` class from todo element', function () {
        var todo = Todo();
        var view = View(todo);
        assert(!(view.el.classList.contains('hidden')));
        view.hide();
        assert(view.el.classList.contains('hidden'));
        view.show();
        assert(!(view.el.classList.contains('hidden')));
    });
});

describe('TodoView#destroy', function () {
    it('causes model to emit `destroy`', function (done) {
        var todo = Todo();
        var view = View(todo);
        todo.on('destroy', function () {
            assert(true);
            done();
        });
        view.destroy();
    });
    it('removes the element from the page', function () {
        var el = document.createElement('div');
        var todo = Todo();
        var view = View(todo);
        el.appendChild(view.el);
        assert(el.children.length === 1);
        assert(el.children[0] === view.el);
        view.destroy();
        assert(!el.children.length);
    });
});
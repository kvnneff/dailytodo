var domify = require('component/domify');
var delegate = require('component/delegate');
var classes = require('component/classes');
var template = require('./template.html');
var View;

/**
 * Initialize `View` with `model`
 * @param {Todo} model
 */
View = function View(model) {
    if (!(this instanceof View)) return new View(model);
    var self = this;
    this.editing = false;
    this.model = model;
    this.el = domify(template);
    this.el.querySelector('.Todo-title').innerHTML = this.model.title;
    this.el.querySelector('[name=complete]').id = 'todo-' + this.model._id;
    this.el.querySelector('label').htmlFor = 'todo-' + this.model._id;
    this.classes = classes(this.el);
    delegate.bind(this.el, 'input', 'click', this.toggleComplete.bind(this));
    delegate.bind(this.el, '.Icon-delete', 'click', this.destroy.bind(this));
    delegate.bind(this.el, '.Todo-title', 'blur', this.toggleEditing.bind(this));
    delegate.bind(this.el, '.Todo-title', 'dblclick', this.toggleEditing.bind(this));

    this.toggleCompleteClass();

    this.model.on('change visible', function (val) {
        if (val) return self.classes.remove('hidden');
        self.classes.add('hidden');
    });
};

/**
 * Toggle editing mode
 * @param  {Event} event
 * @api private
 */
View.prototype.toggleEditing = function toggleEditing(event) {
    if (this.editing === false) {
        event.target.contentEditable = true;
        event.target.focus();
        classes(event.target).add('is-editing');
        this.editing = true;
        return;
    }
    classes(event.target).remove('is-editing');
    event.target.contentEditable = 'false';
    this.editing = false;
};

/**
 * Toggle model's `complete` property
 * @param  {Event} event
 * @api private
 */
View.prototype.toggleComplete = function toggleComplete(event) {
    this.model.set({complete: event.target.checked});
    this.toggleCompleteClass();
};

/**
 * Toggle complete styles
 * @api private
 */
View.prototype.toggleCompleteClass = function(){
    if (this.model.get('complete')) {
        this.el.querySelector('[name=complete]').checked = true;
        this.classes.add('complete');
        return
    }
    this.el.querySelector('[name=complete]').checked = false;
    this.classes.remove('complete');
};

/**
 * Add `hidden` class to `this.el`
 * @api public
 */
View.prototype.hide = function hide() {
    this.classes.add('hidden');
};

/**
 * Remove `hidden` class from `this.el`
 * @api public
 */
View.prototype.show = function show() {
    this.classes.remove('hidden');
};

/**
 * Emit `destroyed` on model and remove element
 * @api private
 */
View.prototype.destroy = function destroy() {
    this.model.emit('destroy');
    this.el.parentElement.removeChild(this.el);
};

module.exports = View;
'use strict';
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
    this.titleEl = this.el.querySelector('.Todo-title');
    this.titleEl.contentEditable = false;
    this.titleEl.innerHTML = this.model.title;
    this.checkboxEl = this.el.querySelector('[name=complete]');
    this.checkboxEl.id = 'todo-' + this.model._id;
    this.el.querySelector('label').htmlFor = 'todo-' + this.model._id;
    this.classes = classes(this.el);
    delegate.bind(this.el, 'input', 'click', this.toggleComplete.bind(this));
    delegate.bind(this.el, '.Icon-delete', 'click', this.destroy.bind(this));
    delegate.bind(this.el, '.Todo-title', 'blur', this.toggleEditing.bind(this));
    delegate.bind(this.el, '.Todo-title', 'dblclick', this.toggleEditing.bind(this));
};

/**
 * Toggle editing mode
 * @api private
 */
View.prototype.toggleEditing = function toggleEditing() {
    if (this.titleEl.contentEditable.toString() === 'false') {
        this.titleEl.contentEditable = true;
        this.titleEl.focus();
        classes(this.titleEl).add('is-editing');
        return;
    }
    classes(this.titleEl).remove('is-editing');
    this.titleEl.contentEditable = false;
};

/**
 * Toggle model's `complete` property
 * @api private
 */
View.prototype.toggleComplete = function toggleComplete() {
    var status = this.checkboxEl.checked;
    this.model.set({complete: status});
    if (this.model.get('complete')) return this.classes.add('complete');
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
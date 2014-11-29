'use strict';
var domify = require('component/domify');
var events = require('component/event');
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
    this.checkboxEl = this.el.querySelector('[name=complete]');
    this.destroyEl = this.el.querySelector('.Icon--delete');

    this.titleEl.contentEditable = false;
    this.titleEl.innerHTML = this.model.title;
    this.checkboxEl.checked = model.get('complete');
    this.checkboxEl.id = 'todo-' + this.model._id;
    this.classes = classes(this.el);

    events.bind(this.titleEl, 'blur', this.toggleEditing.bind(this));
    events.bind(this.titleEl, 'click', this.toggleEditing.bind(this));
    events.bind(this.checkboxEl, 'click', this.toggleComplete.bind(this));
    events.bind(this.destroyEl, 'click', this.destroy.bind(this));

    this.el.querySelector('label').htmlFor = 'todo-' + this.model._id;
};

/**
 * Toggle editing mode
 * @api private
 */
View.prototype.toggleEditing = function toggleEditing(event) {
    if (this.titleEl.contentEditable.toString() === 'false') {
        this.titleEl.contentEditable = true;
        this.titleEl.focus();
        classes(this.titleEl).add('is-editing');
        return;
    }
    if (event && event.type === 'click') return;
    this.titleEl.blur();
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
    this.classes.add('u-hidden');
};

/**
 * Remove `hidden` class from `this.el`
 * @api public
 */
View.prototype.show = function show() {
    this.classes.remove('u-hidden');
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
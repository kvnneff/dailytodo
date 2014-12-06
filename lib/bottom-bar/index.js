var Emitter = require('component/emitter');
var classes = require('component/classes');
var domify = require('component/domify');
var template = require('./template.html');
var BottomBar;

BottomBar = function BottomBar() {
    if (!(this instanceof BottomBar)) return new BottomBar();
    this.el = domify(template);
    this.input = this.el.querySelector('.BottomBar-input');
    this.navItems = this.el.querySelectorAll('.BottomBar-navItem');
    this.bindInput();
};

Emitter(BottomBar.prototype);

BottomBar.prototype.bindInput = function bindInput() {
    var self = this;
    this.input.onkeydown = function (event) {
        if (event.which !== 13 && event.keyCode !== 13) return;
        var text = event.target.value;
        if (text.trim() === '') return;
        event.target.value = '';
        self.emit('input', text);
    };
};

BottomBar.prototype.active = function active(path) {
    for (var i = 0; i < this.navItems.length; i++) {
        var itemPath = this.navItems[i].getAttribute('href');
        if (itemPath === path) {
            classes(this.navItems[i]).add('is-active');
        } else {
            classes(this.navItems[i]).remove('is-active');
        }
    };
};

module.exports = BottomBar;
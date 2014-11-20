var Emitter = require('component/emitter');
var domify = require('component/domify');
var template = require('./template.html');
var BottomBar;

BottomBar = function BottomBar() {
    if (!(this instanceof BottomBar)) return new BottomBar();
    this.el = domify(template);
    this.input = this.el.querySelector('.BottomBar-input');
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

module.exports = BottomBar;
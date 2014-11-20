'use strict';
var page = require('visionmedia/page.js');
var events = require('component/event');
var List = require('./list');
var ListView = require('./list-view');
var BottomBar = require('./bottom-bar');

var listWrapper = document.body.querySelector('.ListWrapper');
var bottomBarWrapper = document.body.querySelector('.BottomBarWrapper');

page('*', function (context, next) {
    listWrapper.innerHTML = '';
    next();
});

page('/', function (context, next) {
    var bottomBar = BottomBar();
    List.today(function (err, list) {
        var listView = ListView(list);
        listWrapper.appendChild(listView.el);
        bottomBarWrapper.appendChild(bottomBar.el);
        bottomBar.on('input', function (todo) {
            list.createTodo({title: todo});
            list.save();
        });
        list.on('change todo', function () {
            list.save();
        });
    });
});

page('/complete', function () {
    List.today(function (err, list) {
        var listView = ListView(list);
        listView.filter('complete', true);
        listWrapper.appendChild(listView.el);
    });
});

page('/incomplete', function () {
    List.today(function (err, list) {
        var listView = ListView(list);
        listView.filter('complete', false);
        listWrapper.appendChild(listView.el);
    });
});

page('/yesterday', function () {
    List.yesterday(function (err, list) {
        var listView = ListView(list);
        listWrapper.appendChild(listView.el);
    });
});

page();

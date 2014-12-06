'use strict';
var page = require('visionmedia/page.js');
var events = require('component/event');
var List = require('./list');
var ListView = require('./list-view');
var BottomBar = require('./bottom-bar');

var listWrapper = document.body.querySelector('.ListWrapper');
var bottomBarWrapper = document.body.querySelector('.BottomBarWrapper');
var bottomBar = BottomBar();

page.base('/dailytodo');

page('*', function (context, next) {
    bottomBar.active(context.pathname);
    listWrapper.innerHTML = '';
    next();
});

page('/', function (context, next) {
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
        list.on('change todo', function () {
            list.save();
        });

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

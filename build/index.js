(function outer(modules, cache, entries){

  /**
   * Global
   */

  var global = (function(){ return this; })();

  /**
   * Require `name`.
   *
   * @param {String} name
   * @param {Boolean} jumped
   * @api public
   */

  function require(name, jumped){
    if (cache[name]) return cache[name].exports;
    if (modules[name]) return call(name, require);
    throw new Error('cannot find module "' + name + '"');
  }

  /**
   * Call module `id` and cache it.
   *
   * @param {Number} id
   * @param {Function} require
   * @return {Function}
   * @api private
   */

  function call(id, require){
    var m = cache[id] = { exports: {} };
    var mod = modules[id];
    var name = mod[2];
    var fn = mod[0];

    fn.call(m.exports, function(req){
      var dep = modules[id][1][req];
      return require(dep ? dep : req);
    }, m, m.exports, outer, modules, cache, entries);

    // expose as `name`.
    if (name) cache[name] = cache[id];

    return cache[id].exports;
  }

  /**
   * Require all entries exposing them on global if needed.
   */

  for (var id in entries) {
    if (entries[id]) {
      global[entries[id]] = require(id);
    } else {
      require(id);
    }
  }

  /**
   * Duo flag.
   */

  require.duo = true;

  /**
   * Expose cache.
   */

  require.cache = cache;

  /**
   * Expose modules
   */

  require.modules = modules;

  /**
   * Return newest require.
   */

   return require;
})({
1: [function(require, module, exports) {
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

}, {"visionmedia/page.js":2,"component/event":3,"./list":4,"./list-view":5,"./bottom-bar":6}],
2: [function(require, module, exports) {
  /* globals require, module */

/**
   * Module dependencies.
   */

  var pathtoRegexp = require('path-to-regexp');

  /**
   * Module exports.
   */

  module.exports = page;

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */

  var location = window.history.location || window.location;

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
  * HashBang option
  */

  var hashbang = false;

  /**
   * Previous context, for capturing
   * page exit events.
   */

  var prevContext;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or redirection,
   * or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page('/from', '/to')
   *   page();
   *
   * @param {String|Function} path
   * @param {Function} fn...
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' === typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' === typeof fn) {
      var route = new Route(path);
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
    // show <path> with [state]
    } else if ('string' == typeof path) {
      'string' === typeof fn
        ? page.redirect(path, fn)
        : page.show(path, fn);
    // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];
  page.exits = [];

  /**
   * Get or set basepath to `path`.
   *
   * @param {String} path
   * @api public
   */

  page.base = function(path){
    if (0 === arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options){
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) window.addEventListener('click', onclick, false);
    if (true === options.hashbang) hashbang = true;
    if (!dispatch) return;
    var url = (hashbang && ~location.hash.indexOf('#!'))
      ? location.hash.substr(2) + location.search
      : location.pathname + location.search + location.hash;
    page.replace(url, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function(){
    if (!running) return;
    running = false;
    window.removeEventListener('click', onclick, false);
    window.removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @param {Boolean} dispatch
   * @return {Context}
   * @api public
   */

  page.show = function(path, state, dispatch){
    var ctx = new Context(path, state);
    if (false !== dispatch) page.dispatch(ctx);
    if (false !== ctx.handled) ctx.pushState();
    return ctx;
  };

  /**
   * Register route to redirect from one path to other
   * or just redirect to another route
   *
   * @param {String} from - if param 'to' is undefined redirects to 'from'
   * @param {String} [to]
   * @api public
   */
  page.redirect = function(from, to) {
    // Define route from a path to another
    if ('string' === typeof from && 'string' === typeof to) {
      page(from, function (e) {
        setTimeout(function() {
          page.replace(to);
        },0);
      });
    }

    // Wait for the push state and replace it with another
    if('string' === typeof from && 'undefined' === typeof to) {
      setTimeout(function() {
          page.replace(from);
      },0);
    }
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @return {Context}
   * @api public
   */

  page.replace = function(path, state, init, dispatch){
    var ctx = new Context(path, state);
    ctx.init = init;
    ctx.save(); // save before dispatching, which may redirect
    if (false !== dispatch) page.dispatch(ctx);
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Object} ctx
   * @api private
   */

  page.dispatch = function(ctx){
    var prev = prevContext;
    var i = 0;
    var j = 0;

    prevContext = ctx;

    function nextExit() {
      var fn = page.exits[j++];
      if (!fn) return nextEnter();
      fn(prev, nextExit);
    }

    function nextEnter() {
      var fn = page.callbacks[i++];
      if (!fn) return unhandled(ctx);
      fn(ctx, nextEnter);
    }

    if (prev) {
      nextExit();
    } else {
      nextEnter();
    }
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */

  function unhandled(ctx) {
    if (ctx.handled) return;
    var current;

    if (hashbang) {
      current = base + location.hash.replace('#!','');
    } else {
      current = location.pathname + location.search;
    }

    if (current === ctx.canonicalPath) return;
    page.stop();
    ctx.handled = false;
    location.href = ctx.canonicalPath;
  }

  /**
   * Register an exit route on `path` with
   * callback `fn()`, which will be called
   * on the previous context when a new
   * page is visited.
   */
  page.exit = function(path, fn) {
    if (typeof path == 'function') {
      return page.exit('*', path);
    };

    var route = new Route(path);
    for (var i = 1; i < arguments.length; ++i) {
      page.exits.push(route.middleware(arguments[i]));
    }
  };

  /**
  * Remove URL encoding from the given `str`.
  * Accommodates whitespace in both x-www-form-urlencoded
  * and regular percent-encoded form.
  *
  * @param {str} URL component to decode
  */
  function decodeURLEncodedURIComponent(str) {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @param {String} path
   * @param {Object} state
   * @api public
   */

  function Context(path, state) {
    path = decodeURLEncodedURIComponent(path);
    if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + path;
    var i = path.indexOf('?');

    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';

    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i
      ? path.slice(i + 1)
      : '';
    this.pathname = ~i
      ? path.slice(0, i)
      : path;
    this.params = [];

    // fragment
    this.hash = '';
    if (!~this.path.indexOf('#')) return;
    var parts = this.path.split('#');
    this.path = parts[0];
    this.hash = parts[1] || '';
    this.querystring = this.querystring.split('#')[0];
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function(){
    history.pushState(this.state
      , this.title
      , hashbang && this.path !== '/'
        ? '#!' + this.path
        : this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function(){
    history.replaceState(this.state
      , this.title
      , hashbang && this.path !== '/'
        ? '#!' + this.path
        : this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @param {String} path
   * @param {Object} options.
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = (path === '*') ? '(.*)' : path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(this.path,
      this.keys = [],
      options.sensitive,
      options.strict);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn){
    var self = this;
    return function(ctx, next){
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    };
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {String} path
   * @param {Array} params
   * @return {Boolean}
   * @api private
   */

  Route.prototype.match = function(path, params){
    var keys = this.keys,
        qsIndex = path.indexOf('?'),
        pathname = ~qsIndex
          ? path.slice(0, qsIndex)
          : path,
        m = this.regexp.exec(decodeURIComponent(pathname));

    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];

      var val = 'string' === typeof m[i]
        ? decodeURIComponent(m[i])
        : m[i];

      if (key) {
        params[key.name] = undefined !== params[key.name]
          ? params[key.name]
          : val;
      } else {
        params.push(val);
      }
    }

    return true;
  };

  /**
   * Handle "populate" events.
   */

  function onpopstate(e) {
    if (e.state) {
      var path = e.state.path;
      page.replace(path, e.state);
    }
  }

  /**
   * Handle "click" events.
   */

  function onclick(e) {
    if (1 != which(e)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;

    // ensure link
    var el = e.target;
    while (el && 'A' != el.nodeName) el = el.parentNode;
    if (!el || 'A' != el.nodeName) return;

    // Ignore if tag has a "download" attribute
    if (el.getAttribute("download")) return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    if (el.pathname === location.pathname && (el.hash || '#' === link)) return;

    // Check for mailto: in the href
    if (link && link.indexOf("mailto:") > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;

    // rebuild path
    var path = el.pathname + el.search + (el.hash || '');

    // same page
    var orig = path;

    path = path.replace(base, '');

    if (base && orig === path) return;

    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null === e.which
      ? e.button
      : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  page.sameOrigin = sameOrigin;

}, {"path-to-regexp":7}],
7: [function(require, module, exports) {
/**
 * Expose `pathtoRegexp`.
 */
module.exports = pathtoRegexp;

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match already escaped characters that would otherwise incorrectly appear
  // in future matches. This allows the user to escape special characters that
  // shouldn't be transformed.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
  // Match regexp special characters that should always be escaped.
  '([.+*?=^!:${}()[\\]|\\/])'
].join('|'), 'g');

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1');
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
var attachKeys = function (re, keys) {
  re.keys = keys;

  return re;
};

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array should be passed in, which will contain the placeholder key
 * names. For example `/user/:id` will then contain `["id"]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 keys
 * @param  {Object}                options
 * @return {RegExp}
 */
function pathtoRegexp (path, keys, options) {
  if (keys && !Array.isArray(keys)) {
    options = keys;
    keys = null;
  }

  keys = keys || [];
  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var flags = options.sensitive ? '' : 'i';
  var index = 0;

  if (path instanceof RegExp) {
    // Match all capturing groups of a regexp.
    var groups = path.source.match(/\((?!\?)/g) || [];

    // Map all the matches to their numeric keys and push into the keys.
    keys.push.apply(keys, groups.map(function (match, index) {
      return {
        name:      index,
        delimiter: null,
        optional:  false,
        repeat:    false
      };
    }));

    // Return the source back to the user.
    return attachKeys(path, keys);
  }

  if (Array.isArray(path)) {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    path = path.map(function (value) {
      return pathtoRegexp(value, keys, options).source;
    });

    // Generate a new regexp instance by joining all the parts together.
    return attachKeys(new RegExp('(?:' + path.join('|') + ')', flags), keys);
  }

  // Alter the path string into a usable regexp.
  path = path.replace(PATH_REGEXP, function (match, escaped, prefix, key, capture, group, suffix, escape) {
    // Avoiding re-escaping escaped characters.
    if (escaped) {
      return escaped;
    }

    // Escape regexp special characters.
    if (escape) {
      return '\\' + escape;
    }

    var repeat   = suffix === '+' || suffix === '*';
    var optional = suffix === '?' || suffix === '*';

    keys.push({
      name:      key || index++,
      delimiter: prefix || '/',
      optional:  optional,
      repeat:    repeat
    });

    // Escape the prefix character.
    prefix = prefix ? '\\' + prefix : '';

    // Match using the custom capturing group, or fallback to capturing
    // everything up to the next slash (or next period if the param was
    // prefixed with a period).
    capture = escapeGroup(capture || group || '[^' + (prefix || '\\/') + ']+?');

    // Allow parameters to be repeated more than once.
    if (repeat) {
      capture = capture + '(?:' + prefix + capture + ')*';
    }

    // Allow a parameter to be optional.
    if (optional) {
      return '(?:' + prefix + '(' + capture + '))?';
    }

    // Basic parameter support.
    return prefix + '(' + capture + ')';
  });

  // Check whether the path ends in a slash as it alters some match behaviour.
  var endsWithSlash = path[path.length - 1] === '/';

  // In non-strict mode we allow an optional trailing slash in the match. If
  // the path to match already ended with a slash, we need to remove it for
  // consistency. The slash is only valid at the very end of a path match, not
  // anywhere in the middle. This is important for non-ending mode, otherwise
  // "/test/" will match "/test//route".
  if (!strict) {
    path = (endsWithSlash ? path.slice(0, -2) : path) + '(?:\\/(?=$))?';
  }

  // In non-ending mode, we need prompt the capturing groups to match as much
  // as possible by using a positive lookahead for the end or next path segment.
  if (!end) {
    path += strict && endsWithSlash ? '' : '(?=\\/|$)';
  }

  return attachKeys(new RegExp('^' + path + (end ? '$' : ''), flags), keys);
};

}, {}],
3: [function(require, module, exports) {
var bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
    unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent',
    prefix = bind !== 'addEventListener' ? 'on' : '';

/**
 * Bind `el` event `type` to `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function(el, type, fn, capture){
  el[bind](prefix + type, fn, capture || false);
  return fn;
};

/**
 * Unbind `el` event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.unbind = function(el, type, fn, capture){
  el[unbind](prefix + type, fn, capture || false);
  return fn;
};
}, {}],
4: [function(require, module, exports) {
'use strict';
var PouchDB = require('pouchdb/pouchdb@3.1.0');
var Emitter = require('component/emitter');
var uid = require('matthewmueller/uid');
var Todo = require('./lib/todo');
var List;
var db;

db = new PouchDB('daily_todo_lists');

function isToday(td) {
    var d = new Date();
    if (isNaN(td.getTime())) return false;
    return td.getDate() == d.getDate() && td.getMonth() == d.getMonth() && td.getFullYear() == d.getFullYear();
};

function isYesterday(yd) {
    var y = new Date();
    y.setDate(y.getDate()-1);
    return yd.getDate() == y.getDate() && yd.getMonth() == y.getMonth() && yd.getFullYear() == y.getFullYear();
};

List = function List(attrs) {
    if (!(this instanceof List)) return new List(attrs);
    attrs = attrs || {};
    var self = this;
    var tmpTodos = attrs.todos || [];
    this._id = attrs._id || uid();
    this._rev = attrs._rev || -1;
    this.timestamp = attrs.timestamp ? new Date(attrs.timestamp) : new Date();
    this.todos = [];
    tmpTodos.forEach(function (todo, index) {
        self.createTodo(todo);
    });
};

Emitter(List.prototype);

List.all = function all() {
    var self = this;
    var collection = [];
    db.allDocs({include_docs: true}, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length) {
            res.rows.forEach(function (row) {
                collection.push(new List(row));
            });
        }
        return cb(collection);
    });
};

List.today = function today(cb) {
    db.query(function (doc, emit) {
        if (isToday(new Date(doc.timestamp))) {
            emit(doc);
        }
    }, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length <= 0) return cb(null, List());
        return cb(null, List(res.rows[0].key));
    });
};

List.yesterday = function yesterday(cb) {
    db.query(function (doc, emit) {
        if (isYesterday(new Date(doc.timestamp))) {
            emit(doc);
        }
    }, function (err, res) {
        if (err) return cb(err);
        if (res.rows.length <= 0) {
            var date = new Date();
            date.setDate(date.getDate()-1);
            return cb(null, new List({timestamp: date}));
        }
        return cb(null, new List(res.rows[0].key));
    });
};

List.prototype.attrs = function attrs() {
    var props = {};
    if (this._id) props._id = this._id;
    if (this._rev !== -1) props._rev = this._rev;
    props.timestamp = this.timestamp;
    props.todos = [];
    this.todos.forEach(function (todo) {
        props.todos.push(todo.attrs());
    });
    return props;
};

List.prototype.save = function save(cb) {
    var self = this;
    db.put(this.attrs(), function (err, doc) {
        if (err && cb) return cb(err);
        if (err) throw err;
        self._rev = doc.rev;
        if (cb) return cb();
    });
};

List.prototype.remove = function remove(cb) {
    db.remove(this.attrs(), function (err, res) {
        if (err) throw err;
        if (cb) return cb(null, res);
    });
};


List.prototype.createTodo = function createTodo(attrs) {
    var self = this;
    var todo = new Todo(attrs);
    todo.on('change', function (prop, val) {
        self.emit('change todo', todo, prop, val);
    });

    todo.on('destroy', function () {
        var todo = this;
        var index = self.todos.indexOf(todo);
        self.todos.splice(index, 1);
        self.save();
    });
    this.todos.push(todo);
    this.emit('create todo', todo);
};

List.prototype.removeTodo = function removeTodo(_id) {
    var self = this;
    this.todos.forEach(function (todo, index) {
        if (todo._id === _id) {
            self.todos.splice(index, 1);
            self.emit('remove todo', todo);
        }
    });
};

module.exports = List;
}, {"pouchdb/pouchdb@3.1.0":8,"component/emitter":9,"matthewmueller/uid":10,"./lib/todo":11}],
8: [function(require, module, exports) {
//    PouchDB 3.1.0
//    
//    (c) 2012-2014 Dale Harvey and the PouchDB team
//    PouchDB may be freely distributed under the Apache license, version 2.0.
//    For all details and documentation:
//    http://pouchdb.com
!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.PouchDB=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

var utils = _dereq_('./utils');
var merge = _dereq_('./merge');
var errors = _dereq_('./deps/errors');
var EventEmitter = _dereq_('events').EventEmitter;
var upsert = _dereq_('./deps/upsert');
var Changes = _dereq_('./changes');
var Promise = utils.Promise;

/*
 * A generic pouch adapter
 */

// returns first element of arr satisfying callback predicate
function arrayFirst(arr, callback) {
  for (var i = 0; i < arr.length; i++) {
    if (callback(arr[i], i) === true) {
      return arr[i];
    }
  }
  return false;
}

// Wrapper for functions that call the bulkdocs api with a single doc,
// if the first result is an error, return an error
function yankError(callback) {
  return function (err, results) {
    if (err || (results[0] && results[0].error)) {
      callback(err || results[0]);
    } else {
      callback(null, results.length ? results[0]  : results);
    }
  };
}

// for every node in a revision tree computes its distance from the closest
// leaf
function computeHeight(revs) {
  var height = {};
  var edges = [];
  merge.traverseRevTree(revs, function (isLeaf, pos, id, prnt) {
    var rev = pos + "-" + id;
    if (isLeaf) {
      height[rev] = 0;
    }
    if (prnt !== undefined) {
      edges.push({from: prnt, to: rev});
    }
    return rev;
  });

  edges.reverse();
  edges.forEach(function (edge) {
    if (height[edge.from] === undefined) {
      height[edge.from] = 1 + height[edge.to];
    } else {
      height[edge.from] = Math.min(height[edge.from], 1 + height[edge.to]);
    }
  });
  return height;
}

function allDocsKeysQuery(api, opts, callback) {
  var keys =  ('limit' in opts) ?
      opts.keys.slice(opts.skip, opts.limit + opts.skip) :
      (opts.skip > 0) ? opts.keys.slice(opts.skip) : opts.keys;
  if (opts.descending) {
    keys.reverse();
  }
  if (!keys.length) {
    return api._allDocs({limit: 0}, callback);
  }
  var finalResults = {
    offset: opts.skip
  };
  return Promise.all(keys.map(function (key, i) {
    var subOpts = utils.extend(true, {key: key, deleted: 'ok'}, opts);
    ['limit', 'skip', 'keys'].forEach(function (optKey) {
      delete subOpts[optKey];
    });
    return new Promise(function (resolve, reject) {
      api._allDocs(subOpts, function (err, res) {
        if (err) {
          return reject(err);
        }
        finalResults.total_rows = res.total_rows;
        resolve(res.rows[0] || {key: key, error: 'not_found'});
      });
    });
  })).then(function (results) {
    finalResults.rows = results;
    return finalResults;
  });
}

utils.inherits(AbstractPouchDB, EventEmitter);
module.exports = AbstractPouchDB;

function AbstractPouchDB() {
  var self = this;
  EventEmitter.call(this);
  self.autoCompact = function (callback) {
    // http doesn't have auto-compaction
    if (!self.auto_compaction || self.type() === 'http') {
      return callback;
    }
    return function (err, res) {
      if (err) {
        callback(err);
      } else {
        var count = res.length;
        var decCount = function () {
          count--;
          if (!count) {
            callback(null, res);
          }
        };
        if (!res.length) {
          return callback(null, res);
        }
        res.forEach(function (doc) {
          if (doc.ok && doc.id) { // if no id, then it was a local doc
            // TODO: we need better error handling
            self.compactDocument(doc.id, 0, decCount);
          } else {
            decCount();
          }
        });
      }
    };
  };

  var listeners = 0, changes;
  var eventNames = ['change', 'delete', 'create', 'update'];
  this.on('newListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      if (listeners) {
        listeners++;
        return;
      } else {
        listeners++;
      }
    } else {
      return;
    }
    var lastChange = 0;
    changes = this.changes({
      conflicts: true,
      include_docs: true,
      continuous: true,
      since: 'now',
      onChange: function (change) {
        if (change.seq <= lastChange) {
          return;
        }
        lastChange = change.seq;
        self.emit('change', change);
        if (change.doc._deleted) {
          self.emit('delete', change);
        } else if (change.doc._rev.split('-')[0] === '1') {
          self.emit('create', change);
        } else {
          self.emit('update', change);
        }
      }
    });
  });
  this.on('removeListener', function (eventName) {
    if (~eventNames.indexOf(eventName)) {
      listeners--;
      if (listeners) {
        return;
      }
    } else {
      return;
    }
    changes.cancel();
  });
}

AbstractPouchDB.prototype.post =
  utils.adapterFun('post', function (doc, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return callback(errors.NOT_AN_OBJECT);
  }
  this.bulkDocs({docs: [doc]}, opts,
      this.autoCompact(yankError(callback)));
});

AbstractPouchDB.prototype.put =
  utils.adapterFun('put', utils.getArguments(function (args) {
  var temp, temptype, opts, callback;
  var doc = args.shift();
  var id = '_id' in doc;
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    callback = args.pop();
    return callback(errors.NOT_AN_OBJECT);
  }
  doc = utils.clone(doc);
  while (true) {
    temp = args.shift();
    temptype = typeof temp;
    if (temptype === "string" && !id) {
      doc._id = temp;
      id = true;
    } else if (temptype === "string" && id && !('_rev' in doc)) {
      doc._rev = temp;
    } else if (temptype === "object") {
      opts = temp;
    } else if (temptype === "function") {
      callback = temp;
    }
    if (!args.length) {
      break;
    }
  }
  opts = opts || {};
  var error = utils.invalidIdError(doc._id);
  if (error) {
    return callback(error);
  }
  if (utils.isLocalId(doc._id) && typeof this._putLocal === 'function') {
    if (doc._deleted) {
      return this._removeLocal(doc, callback);
    } else {
      return this._putLocal(doc, callback);
    }
  }
  this.bulkDocs({docs: [doc]}, opts,
      this.autoCompact(yankError(callback)));
}));

AbstractPouchDB.prototype.putAttachment =
  utils.adapterFun('putAttachment', function (docId, attachmentId, rev,
                                              blob, type, callback) {
  var api = this;
  if (typeof type === 'function') {
    callback = type;
    type = blob;
    blob = rev;
    rev = null;
  }
  if (typeof type === 'undefined') {
    type = blob;
    blob = rev;
    rev = null;
  }

  function createAttachment(doc) {
    doc._attachments = doc._attachments || {};
    doc._attachments[attachmentId] = {
      content_type: type,
      data: blob
    };
    return api.put(doc);
  }

  return api.get(docId).then(function (doc) {
    if (doc._rev !== rev) {
      throw errors.REV_CONFLICT;
    }

    return createAttachment(doc);
  }, function (err) {
     // create new doc
    if (err.error === errors.MISSING_DOC.error) {
      return createAttachment({_id: docId});
    } else {
      throw err;
    }
  });
});

AbstractPouchDB.prototype.removeAttachment =
  utils.adapterFun('removeAttachment', function (docId, attachmentId, rev,
                                                 callback) {
  var self = this;
  self.get(docId, function (err, obj) {
    if (err) {
      callback(err);
      return;
    }
    if (obj._rev !== rev) {
      callback(errors.REV_CONFLICT);
      return;
    }
    if (!obj._attachments) {
      return callback();
    }
    delete obj._attachments[attachmentId];
    if (Object.keys(obj._attachments).length === 0) {
      delete obj._attachments;
    }
    self.put(obj, callback);
  });
});

AbstractPouchDB.prototype.remove =
  utils.adapterFun('remove', function (docOrId, optsOrRev, opts, callback) {
  var doc;
  if (typeof optsOrRev === 'string') {
    // id, rev, opts, callback style
    doc = {
      _id: docOrId,
      _rev: optsOrRev
    };
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
  } else {
    // doc, opts, callback style
    doc = docOrId;
    if (typeof optsOrRev === 'function') {
      callback = optsOrRev;
      opts = {};
    } else {
      callback = opts;
      opts = optsOrRev;
    }
  }
  opts = utils.clone(opts || {});
  opts.was_delete = true;
  var newDoc = {_id: doc._id, _rev: (doc._rev || opts.rev)};
  newDoc._deleted = true;
  if (utils.isLocalId(newDoc._id) && typeof this._removeLocal === 'function') {
    return this._removeLocal(doc, callback);
  }
  this.bulkDocs({docs: [newDoc]}, opts, yankError(callback));
});

AbstractPouchDB.prototype.revsDiff =
  utils.adapterFun('revsDiff', function (req, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  var ids = Object.keys(req);

  if (!ids.length) {
    return callback(null, {});
  }

  var count = 0;
  var missing = new utils.Map();

  function addToMissing(id, revId) {
    if (!missing.has(id)) {
      missing.set(id, {missing: []});
    }
    missing.get(id).missing.push(revId);
  }

  function processDoc(id, rev_tree) {
    // Is this fast enough? Maybe we should switch to a set simulated by a map
    var missingForId = req[id].slice(0);
    merge.traverseRevTree(rev_tree, function (isLeaf, pos, revHash, ctx,
      opts) {
        var rev = pos + '-' + revHash;
        var idx = missingForId.indexOf(rev);
        if (idx === -1) {
          return;
        }

        missingForId.splice(idx, 1);
        if (opts.status !== 'available') {
          addToMissing(id, rev);
        }
      });

    // Traversing the tree is synchronous, so now `missingForId` contains
    // revisions that were not found in the tree
    missingForId.forEach(function (rev) {
      addToMissing(id, rev);
    });
  }

  ids.map(function (id) {
    this._getRevisionTree(id, function (err, rev_tree) {
      if (err && err.status === 404 && err.message === 'missing') {
        missing.set(id, {missing: req[id]});
      } else if (err) {
        return callback(err);
      } else {
        processDoc(id, rev_tree);
      }

      if (++count === ids.length) {
        // convert LazyMap to object
        var missingObj = {};
        missing.forEach(function (value, key) {
          missingObj[key] = value;
        });
        return callback(null, missingObj);
      }
    });
  }, this);
});

// compact one document and fire callback
// by compacting we mean removing all revisions which
// are further from the leaf in revision tree than max_height
AbstractPouchDB.prototype.compactDocument =
  utils.adapterFun('compactDocument', function (docId, maxHeight, callback) {
  var self = this;
  this._getRevisionTree(docId, function (err, revTree) {
    if (err) {
      return callback(err);
    }
    var height = computeHeight(revTree);
    var candidates = [];
    var revs = [];
    Object.keys(height).forEach(function (rev) {
      if (height[rev] > maxHeight) {
        candidates.push(rev);
      }
    });

    merge.traverseRevTree(revTree, function (isLeaf, pos, revHash, ctx, opts) {
      var rev = pos + '-' + revHash;
      if (opts.status === 'available' && candidates.indexOf(rev) !== -1) {
        revs.push(rev);
      }
    });
    self._doCompaction(docId, revs, callback);
  });
});

// compact the whole database using single document
// compaction
AbstractPouchDB.prototype.compact =
  utils.adapterFun('compact', function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  var self = this;

  opts = utils.clone(opts || {});

  self.get('_local/compaction')["catch"](function () {
    return false;
  }).then(function (doc) {
    if (typeof self._compact === 'function') {
      if (doc && doc.last_seq) {
        opts.last_seq = doc.last_seq;
      }
      return self._compact(opts, callback);
    }

  });
});
AbstractPouchDB.prototype._compact = function (opts, callback) {
  var done = false;
  var started = 0;
  var copts = {
    returnDocs: false
  };
  var self = this;
  var lastSeq;
  function finish() {
    upsert(self, '_local/compaction', function (doc) {
      if (!doc.last_seq || doc.last_seq < lastSeq) {
        doc.last_seq = lastSeq;
        return doc;
      }
      return false; // somebody else got here first, don't update
    }, callback);
  }
  if (opts.last_seq) {
    copts.since = opts.last_seq;
  }
  function afterCompact() {
    started--;
    if (!started && done) {
      finish();
    }
  }
  function onChange(row) {
    started++;
    self.compactDocument(row.id, 0).then(afterCompact, callback);
  }
  self.changes(copts).on('change', onChange).on('complete', function (resp) {
    done = true;
    lastSeq = resp.last_seq;
    if (!started) {
      finish();
    }
  }).on('error', callback);
};
/* Begin api wrappers. Specific functionality to storage belongs in the 
   _[method] */
AbstractPouchDB.prototype.get =
  utils.adapterFun('get', function (id, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof id !== 'string') {
    return callback(errors.INVALID_ID);
  }
  if (utils.isLocalId(id) && typeof this._getLocal === 'function') {
    return this._getLocal(id, callback);
  }
  var leaves = [], self = this;
  function finishOpenRevs() {
    var result = [];
    var count = leaves.length;
    if (!count) {
      return callback(null, result);
    }
    // order with open_revs is unspecified
    leaves.forEach(function (leaf) {
      self.get(id,
               {rev: leaf, revs: opts.revs, attachments: opts.attachments},
               function (err, doc) {
        if (!err) {
          result.push({ok: doc});
        } else {
          result.push({missing: leaf});
        }
        count--;
        if (!count) {
          callback(null, result);
        }
      });
    });
  }

  if (opts.open_revs) {
    if (opts.open_revs === "all") {
      this._getRevisionTree(id, function (err, rev_tree) {
        if (err) {
          // if there's no such document we should treat this
          // situation the same way as if revision tree was empty
          rev_tree = [];
        }
        leaves = merge.collectLeaves(rev_tree).map(function (leaf) {
          return leaf.rev;
        });
        finishOpenRevs();
      });
    } else {
      if (Array.isArray(opts.open_revs)) {
        leaves = opts.open_revs;
        for (var i = 0; i < leaves.length; i++) {
          var l = leaves[i];
          // looks like it's the only thing couchdb checks
          if (!(typeof(l) === "string" && /^\d+-/.test(l))) {
            return callback(errors.error(errors.BAD_REQUEST,
              "Invalid rev format"));
          }
        }
        finishOpenRevs();
      } else {
        return callback(errors.error(errors.UNKNOWN_ERROR,
          'function_clause'));
      }
    }
    return; // open_revs does not like other options
  }

  return this._get(id, opts, function (err, result) {
    opts = utils.clone(opts);
    if (err) {
      return callback(err);
    }

    var doc = result.doc;
    if (!doc) {
      // a smoke test for something being very wrong
      return callback(new Error('no doc!'));
    }
    var metadata = result.metadata;
    var ctx = result.ctx;

    if (opts.conflicts) {
      var conflicts = merge.collectConflicts(metadata);
      if (conflicts.length) {
        doc._conflicts = conflicts;
      }
    }

    if (opts.revs || opts.revs_info) {
      var paths = merge.rootToLeaf(metadata.rev_tree);
      var path = arrayFirst(paths, function (arr) {
        return arr.ids.map(function (x) { return x.id; })
          .indexOf(doc._rev.split('-')[1]) !== -1;
      });

      var indexOfRev = path.ids.map(function (x) {return x.id; })
        .indexOf(doc._rev.split('-')[1]) + 1;
      var howMany = path.ids.length - indexOfRev;
      path.ids.splice(indexOfRev, howMany);
      path.ids.reverse();

      if (opts.revs) {
        doc._revisions = {
          start: (path.pos + path.ids.length) - 1,
          ids: path.ids.map(function (rev) {
            return rev.id;
          })
        };
      }
      if (opts.revs_info) {
        var pos =  path.pos + path.ids.length;
        doc._revs_info = path.ids.map(function (rev) {
          pos--;
          return {
            rev: pos + '-' + rev.id,
            status: rev.opts.status
          };
        });
      }
    }

    if (opts.local_seq) {
      doc._local_seq = result.metadata.seq;
    }

    if (opts.attachments && doc._attachments) {
      var attachments = doc._attachments;
      var count = Object.keys(attachments).length;
      if (count === 0) {
        return callback(null, doc);
      }
      Object.keys(attachments).forEach(function (key) {
        this._getAttachment(attachments[key],
                            {encode: true, ctx: ctx}, function (err, data) {
          var att = doc._attachments[key];
          att.data = data;
          delete att.stub;
          delete att.length;
          if (!--count) {
            callback(null, doc);
          }
        });
      }, self);
    } else {
      if (doc._attachments) {
        for (var key in doc._attachments) {
          if (doc._attachments.hasOwnProperty(key)) {
            doc._attachments[key].stub = true;
          }
        }
      }
      callback(null, doc);
    }
  });
});

AbstractPouchDB.prototype.getAttachment =
  utils.adapterFun('getAttachment', function (docId, attachmentId, opts,
                                              callback) {
  var self = this;
  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  this._get(docId, opts, function (err, res) {
    if (err) {
      return callback(err);
    }
    if (res.doc._attachments && res.doc._attachments[attachmentId]) {
      opts.ctx = res.ctx;
      self._getAttachment(res.doc._attachments[attachmentId], opts, callback);
    } else {
      return callback(errors.MISSING_DOC);
    }
  });
});

AbstractPouchDB.prototype.allDocs =
  utils.adapterFun('allDocs', function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  opts.skip = typeof opts.skip !== 'undefined' ? opts.skip : 0;
  if ('keys' in opts) {
    if (!Array.isArray(opts.keys)) {
      return callback(new TypeError('options.keys must be an array'));
    }
    var incompatibleOpt =
      ['startkey', 'endkey', 'key'].filter(function (incompatibleOpt) {
      return incompatibleOpt in opts;
    })[0];
    if (incompatibleOpt) {
      callback(errors.error(errors.QUERY_PARSE_ERROR,
        'Query parameter `' + incompatibleOpt +
        '` is not compatible with multi-get'
      ));
      return;
    }
    if (this.type() !== 'http') {
      return allDocsKeysQuery(this, opts, callback);
    }
  }

  return this._allDocs(opts, callback);
});

AbstractPouchDB.prototype.changes = function (opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return new Changes(this, opts, callback);
};

AbstractPouchDB.prototype.close =
  utils.adapterFun('close', function (callback) {
  this._closed = true;
  return this._close(callback);
});

AbstractPouchDB.prototype.info = utils.adapterFun('info', function (callback) {
  var self = this;
  this._info(function (err, info) {
    if (err) {
      return callback(err);
    }
    // assume we know better than the adapter, unless it informs us
    info.db_name = info.db_name || self._db_name;
    info.auto_compaction = !!(self._auto_compaction && self.type() !== 'http');
    callback(null, info);
  });
});

AbstractPouchDB.prototype.id = utils.adapterFun('id', function (callback) {
  return this._id(callback);
});

AbstractPouchDB.prototype.type = function () {
  return (typeof this._type === 'function') ? this._type() : this.adapter;
};

AbstractPouchDB.prototype.bulkDocs =
  utils.adapterFun('bulkDocs', function (req, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  opts = utils.clone(opts);

  if (Array.isArray(req)) {
    req = {
      docs: req
    };
  }

  if (!req || !req.docs || !Array.isArray(req.docs)) {
    return callback(errors.MISSING_BULK_DOCS);
  }

  for (var i = 0; i < req.docs.length; ++i) {
    if (typeof req.docs[i] !== 'object' || Array.isArray(req.docs[i])) {
      return callback(errors.NOT_AN_OBJECT);
    }
  }

  req = utils.clone(req);
  if (!('new_edits' in opts)) {
    if ('new_edits' in req) {
      opts.new_edits = req.new_edits;
    } else {
      opts.new_edits = true;
    }
  }

  if (!opts.new_edits && this.type() !== 'http') {
    // ensure revisions of the same doc are sorted, so that
    // the local adapter processes them correctly (#2935)
    req.docs.sort(function (a, b) {
      var idCompare = utils.compare(a._id, b._id);
      if (idCompare !== 0) {
        return idCompare;
      }
      var aStart = a._revisions ? a._revisions.start : 0;
      var bStart = b._revisions ? b._revisions.start : 0;
      return utils.compare(aStart, bStart);
    });
  }

  return this._bulkDocs(req, opts, this.autoCompact(function (err, res) {
    if (err) {
      return callback(err);
    }
    if (!opts.new_edits) {
      // this is what couch does when new_edits is false
      res = res.filter(function (x) {
        return x.error;
      });
    }
    callback(null, res);
  }));
});

AbstractPouchDB.prototype.registerDependentDatabase =
  utils.adapterFun('registerDependentDatabase', function (dependentDb,
                                                          callback) {
  var opts = {};
  if (this.__opts.db) {
    opts.db = this.__opts.db;
  }
  if (this._adapter) {
    opts.adapter = this._adapter;
  }

  var depDB = new this.constructor(dependentDb, opts);

  function diffFun(doc) {
    doc.dependentDbs = doc.dependentDbs || {};
    if (doc.dependentDbs[dependentDb]) {
      return false; // no update required
    }
    doc.dependentDbs[dependentDb] = true;
    return doc;
  }
  upsert(this, '_local/_pouch_dependentDbs', diffFun, function (err) {
    if (err) {
      return callback(err);
    }
    return callback(null, {db: depDB});
  });
});

},{"./changes":6,"./deps/errors":12,"./deps/upsert":16,"./merge":21,"./utils":26,"events":30}],2:[function(_dereq_,module,exports){
(function (process){
"use strict";

var CHANGES_BATCH_SIZE = 25;

var utils = _dereq_('../utils');
var errors = _dereq_('../deps/errors');

function encodeDocId(id) {
  if (/^_(design|local)/.test(id)) {
    return id;
  }
  return encodeURIComponent(id);
}

function preprocessAttachments(doc) {
  if (!doc._attachments || !Object.keys(doc._attachments)) {
    return utils.Promise.resolve();
  }

  return utils.Promise.all(Object.keys(doc._attachments).map(function (key) {
    var attachment = doc._attachments[key];
    if (attachment.data && typeof attachment.data !== 'string') {
      if (typeof process === undefined || process.browser) {
        return new utils.Promise(function (resolve) {
          utils.readAsBinaryString(attachment.data, function (binary) {
            attachment.data = utils.btoa(binary);
            resolve();
          });
        });
      } else {
        attachment.data = attachment.data.toString('base64');
      }
    }
  }));
}

// Get all the information you possibly can about the URI given by name and
// return it as a suitable object.
function getHost(name, opts) {
  // If the given name contains "http:"
  if (/http(s?):/.test(name)) {
    // Prase the URI into all its little bits
    var uri = utils.parseUri(name);

    // Store the fact that it is a remote URI
    uri.remote = true;

    // Store the user and password as a separate auth object
    if (uri.user || uri.password) {
      uri.auth = {username: uri.user, password: uri.password};
    }

    // Split the path part of the URI into parts using '/' as the delimiter
    // after removing any leading '/' and any trailing '/'
    var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');

    // Store the first part as the database name and remove it from the parts
    // array
    uri.db = parts.pop();

    // Restore the path by joining all the remaining parts (all the parts
    // except for the database name) with '/'s
    uri.path = parts.join('/');
    opts = opts || {};
    opts = utils.clone(opts);
    uri.headers = opts.headers || {};

    if (opts.auth || uri.auth) {
      var nAuth = opts.auth || uri.auth;
      var token = utils.btoa(nAuth.username + ':' + nAuth.password);
      uri.headers.Authorization = 'Basic ' + token;
    }

    if (opts.headers) {
      uri.headers = opts.headers;
    }

    return uri;
  }

  // If the given name does not contain 'http:' then return a very basic object
  // with no host, the current path, the given name as the database name and no
  // username/password
  return {host: '', path: '/', db: name, auth: false};
}

// Generate a URL with the host data given by opts and the given path
function genDBUrl(opts, path) {
  return genUrl(opts, opts.db + '/' + path);
}

// Generate a URL with the host data given by opts and the given path
function genUrl(opts, path) {
  if (opts.remote) {
    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    var pathDel = !opts.path ? '' : '/';

    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' +
           opts.path + pathDel + path;
  }

  return '/' + path;
}
// Implements the PouchDB API for dealing with CouchDB instances over HTTP
function HttpPouch(opts, callback) {
  // The functions that will be publicly available for HttpPouch
  var api = this;
  api.getHost = opts.getHost ? opts.getHost : getHost;

  // Parse the URI given by opts.name into an easy-to-use object
  var host = api.getHost(opts.name, opts);

  // Generate the database URL based on the host
  var dbUrl = genDBUrl(host, '');

  api.getUrl = function () {return dbUrl; };
  api.getHeaders = function () {return utils.clone(host.headers); };

  var ajaxOpts = opts.ajax || {};
  opts = utils.clone(opts);
  function ajax(options, callback) {
    return utils.ajax(utils.extend({}, ajaxOpts, options), callback);
  }

  // Create a new CouchDB database based on the given opts
  var createDB = function () {
    ajax({headers: host.headers, method: 'PUT', url: dbUrl},
         function (err, ret) {
      // If we get an "Unauthorized" error
      if (err && err.status === 401) {
        // Test if the database already exists
        ajax({headers: host.headers, method: 'HEAD', url: dbUrl},
             function (err, ret) {
          // If there is still an error
          if (err) {
            // Give the error to the callback to deal with
            callback(err);
          } else {
            // Continue as if there had been no errors
            callback(null, api);
          }
        });
        // If there were no errros or if the only error is "Precondition Failed"
        // (note: "Precondition Failed" occurs when we try to create a database
        // that already exists)
      } else if (!err || err.status === 412) {
        // Continue as if there had been no errors
        callback(null, api);
      } else {
        callback(err);
      }
    });
  };
  if (!opts.skipSetup) {
    ajax({headers: host.headers, method: 'GET', url: dbUrl},
         function (err, ret) {
      //check if the db exists
      if (err) {
        if (err.status === 404) {
          utils.explain404(
            'PouchDB is just detecting if the remote DB exists.');
          //if it doesn't, create it
          createDB();
        } else {
          callback(err);
        }
      } else {
        //go do stuff with the db
        callback(null, api);
      }
    });
  }

  api.type = function () {
    return 'http';
  };

  api.id = utils.adapterFun('id', function (callback) {
    ajax({
      headers: host.headers,
      method: 'GET',
      url: genUrl(host, '')
    }, function (err, result) {
      var uuid = (result && result.uuid) ?
        result.uuid + host.db : genDBUrl(host, '');
      callback(null, uuid);
    });
  });

  api.request = utils.adapterFun('request', function (options, callback) {
    options.headers = host.headers;
    options.url = genDBUrl(host, options.url);
    ajax(options, callback);
  });

  // Sends a POST request to the host calling the couchdb _compact function
  //    version: The version of CouchDB it is running
  api.compact = utils.adapterFun('compact', function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    ajax({
      headers: host.headers,
      url: genDBUrl(host, '_compact'),
      method: 'POST'
    }, function () {
      function ping() {
        api.info(function (err, res) {
          if (!res.compact_running) {
            callback();
          } else {
            setTimeout(ping, opts.interval || 200);
          }
        });
      }
      // Ping the http if it's finished compaction
      if (typeof callback === "function") {
        ping();
      }
    });
  });

  // Calls GET on the host, which gets back a JSON string containing
  //    couchdb: A welcome string
  //    version: The version of CouchDB it is running
  api._info = function (callback) {
    ajax({
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, '')
    }, function (err, res) {
      if (err) {
        callback(err);
      } else {
        res.host = genDBUrl(host, '');
        callback(null, res);
      }
    });
  };

  // Get the document with the given id from the database given by host.
  // The id could be solely the _id in the database, or it may be a
  // _design/ID or _local/ID path
  api.get = utils.adapterFun('get', function (id, opts, callback) {
    // If no options were given, set the callback to the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }

    // List of parameters to add to the GET request
    var params = [];

    // If it exists, add the opts.revs value to the list of parameters.
    // If revs=true then the resulting JSON will include a field
    // _revisions containing an array of the revision IDs.
    if (opts.revs) {
      params.push('revs=true');
    }

    // If it exists, add the opts.revs_info value to the list of parameters.
    // If revs_info=true then the resulting JSON will include the field
    // _revs_info containing an array of objects in which each object
    // representing an available revision.
    if (opts.revs_info) {
      params.push('revs_info=true');
    }

    if (opts.local_seq) {
      params.push('local_seq=true');
    }
    // If it exists, add the opts.open_revs value to the list of parameters.
    // If open_revs=all then the resulting JSON will include all the leaf
    // revisions. If open_revs=["rev1", "rev2",...] then the resulting JSON
    // will contain an array of objects containing data of all revisions
    if (opts.open_revs) {
      if (opts.open_revs !== "all") {
        opts.open_revs = JSON.stringify(opts.open_revs);
      }
      params.push('open_revs=' + opts.open_revs);
    }

    // If it exists, add the opts.attachments value to the list of parameters.
    // If attachments=true the resulting JSON will include the base64-encoded
    // contents in the "data" property of each attachment.
    if (opts.attachments) {
      params.push('attachments=true');
    }

    // If it exists, add the opts.rev value to the list of parameters.
    // If rev is given a revision number then get the specified revision.
    if (opts.rev) {
      params.push('rev=' + opts.rev);
    }

    // If it exists, add the opts.conflicts value to the list of parameters.
    // If conflicts=true then the resulting JSON will include the field
    // _conflicts containing all the conflicting revisions.
    if (opts.conflicts) {
      params.push('conflicts=' + opts.conflicts);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    if (opts.auto_encode) {
      id = encodeDocId(id);
    }

    // Set the options for the ajax call
    var options = {
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, id + params)
    };

    // If the given id contains at least one '/' and the part before the '/'
    // is NOT "_design" and is NOT "_local"
    // OR
    // If the given id contains at least two '/' and the part before the first
    // '/' is "_design".
    // TODO This second condition seems strange since if parts[0] === '_design'
    // then we already know that parts[0] !== '_local'.
    var parts = id.split('/');
    if ((parts.length > 1 && parts[0] !== '_design' && parts[0] !== '_local') ||
        (parts.length > 2 && parts[0] === '_design' && parts[0] !== '_local')) {
      // Binary is expected back from the server
      options.binary = true;
    }

    // Get the document
    ajax(options, function (err, doc, xhr) {
      // If the document does not exist, send an error to the callback
      if (err) {
        return callback(err);
      }

      // Send the document to the callback
      callback(null, doc, xhr);
    });
  });

  // Delete the document given by doc from the database given by host.
  api.remove = utils.adapterFun('remove',
      function (docOrId, optsOrRev, opts, callback) {
    var doc;
    if (typeof optsOrRev === 'string') {
      // id, rev, opts, callback style
      doc = {
        _id: docOrId,
        _rev: optsOrRev
      };
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
    } else {
      // doc, opts, callback style
      doc = docOrId;
      if (typeof optsOrRev === 'function') {
        callback = optsOrRev;
        opts = {};
      } else {
        callback = opts;
        opts = optsOrRev;
      }
    }

    var rev = (doc._rev || opts.rev);

    // Delete the document
    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: genDBUrl(host, encodeDocId(doc._id)) + '?rev=' + rev
    }, callback);
  });

  function encodeAttachmentId(attachmentId) {
    return attachmentId.split("/").map(encodeURIComponent).join("/");
  }

  // Get the attachment
  api.getAttachment =
    utils.adapterFun('getAttachment', function (docId, attachmentId, opts,
                                                callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }
    if (opts.auto_encode) {
      docId = encodeDocId(docId);
    }
    opts.auto_encode = false;
    api.get(docId + '/' + encodeAttachmentId(attachmentId), opts, callback);
  });

  // Remove the attachment given by the id and rev
  api.removeAttachment =
    utils.adapterFun('removeAttachment', function (docId, attachmentId, rev,
                                                   callback) {

    var url = genDBUrl(host, encodeDocId(docId) + '/' +
      encodeAttachmentId(attachmentId)) + '?rev=' + rev;

    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: url
    }, callback);
  });

  // Add the attachment given by blob and its contentType property
  // to the document with the given id, the revision given by rev, and
  // add it to the database given by host.
  api.putAttachment =
    utils.adapterFun('putAttachment', function (docId, attachmentId, rev, blob,
                                                type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = blob;
      blob = rev;
      rev = null;
    }
    if (typeof type === 'undefined') {
      type = blob;
      blob = rev;
      rev = null;
    }
    var id = encodeDocId(docId) + '/' + encodeAttachmentId(attachmentId);
    var url = genDBUrl(host, id);
    if (rev) {
      url += '?rev=' + rev;
    }

    if (typeof blob === 'string') {
      try {
        blob = utils.atob(blob);
      } catch (err) {
        // it's not base64-encoded, so throw error
        return callback(utils.extend({}, errors.BAD_ARG,
          {reason: "Attachments need to be base64 encoded"}));
      }
    }

    var opts = {
      headers: utils.clone(host.headers),
      method: 'PUT',
      url: url,
      processData: false,
      body: blob,
      timeout: 60000
    };
    opts.headers['Content-Type'] = type;
    // Add the attachment
    ajax(opts, callback);
  });

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This fails if the doc has no _id field.
  api.put = utils.adapterFun('put', utils.getArguments(function (args) {
    var temp, temptype, opts;
    var doc = args.shift();
    var id = '_id' in doc;
    var callback = args.pop();
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      return callback(errors.NOT_AN_OBJECT);
    }

    doc = utils.clone(doc);

    preprocessAttachments(doc).then(function () {
      while (true) {
        temp = args.shift();
        temptype = typeof temp;
        if (temptype === "string" && !id) {
          doc._id = temp;
          id = true;
        } else if (temptype === "string" && id && !('_rev' in doc)) {
          doc._rev = temp;
        } else if (temptype === "object") {
          opts = utils.clone(temp);
        }
        if (!args.length) {
          break;
        }
      }
      opts = opts || {};
      var error = utils.invalidIdError(doc._id);
      if (error) {
        throw error;
      }

      // List of parameter to add to the PUT request
      var params = [];

      // If it exists, add the opts.new_edits value to the list of parameters.
      // If new_edits = false then the database will NOT assign this document a
      // new revision number
      if (opts && typeof opts.new_edits !== 'undefined') {
        params.push('new_edits=' + opts.new_edits);
      }

      // Format the list of parameters into a valid URI query string
      params = params.join('&');
      if (params !== '') {
        params = '?' + params;
      }

      // Add the document
      ajax({
        headers: host.headers,
        method: 'PUT',
        url: genDBUrl(host, encodeDocId(doc._id)) + params,
        body: doc
      }, function (err, res) {
        if (err) {
          return callback(err);
        }
        res.ok = true;
        callback(null, res);
      });
    })["catch"](callback);

  }));

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This does not assume that doc is a new document 
  // (i.e. does not have a _id or a _rev field.)
  api.post = utils.adapterFun('post', function (doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    if (typeof doc !== 'object') {
      return callback(errors.NOT_AN_OBJECT);
    }
    if (! ("_id" in doc)) {
      doc._id = utils.uuid();
    }
    api.put(doc, opts, function (err, res) {
      if (err) {
        return callback(err);
      }
      res.ok = true;
      callback(null, res);
    });
  });

  // Update/create multiple documents given by req in the database
  // given by host.
  api._bulkDocs = function (req, opts, callback) {
    // If opts.new_edits exists add it to the document data to be
    // send to the database.
    // If new_edits=false then it prevents the database from creating
    // new revision numbers for the documents. Instead it just uses
    // the old ones. This is used in database replication.
    if (typeof opts.new_edits !== 'undefined') {
      req.new_edits = opts.new_edits;
    }

    utils.Promise.all(req.docs.map(preprocessAttachments)).then(function () {
      // Update/create the documents
      ajax({
        headers: host.headers,
        method: 'POST',
        url: genDBUrl(host, '_bulk_docs'),
        body: req
      }, function (err, results) {
        if (err) {
          return callback(err);
        }
        results.forEach(function (result) {
          result.ok = true; // smooths out cloudant not adding this
        });
        callback(null, results);
      });
    })["catch"](callback);
  };

  // Get a listing of the documents in the database given
  // by host and ordered by increasing id.
  api.allDocs = utils.adapterFun('allDocs', function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = utils.clone(opts);
    // List of parameters to add to the GET request
    var params = [];
    var body;
    var method = 'GET';

    // TODO I don't see conflicts as a valid parameter for a
    // _all_docs request 
    // (see http://wiki.apache.org/couchdb/HTTP_Document_API#all_docs)
    if (opts.conflicts) {
      params.push('conflicts=true');
    }

    // If opts.descending is truthy add it to params
    if (opts.descending) {
      params.push('descending=true');
    }

    // If opts.include_docs exists, add the include_docs value to the
    // list of parameters.
    // If include_docs=true then include the associated document with each
    // result.
    if (opts.include_docs) {
      params.push('include_docs=true');
    }

    if (opts.key) {
      params.push('key=' + encodeURIComponent(JSON.stringify(opts.key)));
    }

    // If opts.startkey exists, add the startkey value to the list of
    // parameters.
    // If startkey is given then the returned list of documents will
    // start with the document whose id is startkey.
    if (opts.startkey) {
      params.push('startkey=' +
        encodeURIComponent(JSON.stringify(opts.startkey)));
    }

    // If opts.endkey exists, add the endkey value to the list of parameters.
    // If endkey is given then the returned list of docuemnts will
    // end with the document whose id is endkey.
    if (opts.endkey) {
      params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
    }

    if (typeof opts.inclusive_end !== 'undefined') {
      params.push('inclusive_end=' + !!opts.inclusive_end);
    }

    // If opts.limit exists, add the limit value to the parameter list.
    if (typeof opts.limit !== 'undefined') {
      params.push('limit=' + opts.limit);
    }

    if (typeof opts.skip !== 'undefined') {
      params.push('skip=' + opts.skip);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    if (typeof opts.keys !== 'undefined') {

      var MAX_URL_LENGTH = 2000;
      // according to http://stackoverflow.com/a/417184/680742,
      // the de factor URL length limit is 2000 characters

      var keysAsString =
        'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
      if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
        // If the keys are short enough, do a GET. we do this to work around
        // Safari not understanding 304s on POSTs (see issue #1239)
        params += (params.indexOf('?') !== -1 ? '&' : '?') + keysAsString;
      } else {
        // If keys are too long, issue a POST request to circumvent GET
        // query string limits
        // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
        method = 'POST';
        body = JSON.stringify({keys: opts.keys});
      }
    }

    // Get the document listing
    ajax({
      headers: host.headers,
      method: method,
      url: genDBUrl(host, '_all_docs' + params),
      body: body
    }, callback);
  });

  // Get a list of changes made to documents in the database given by host.
  // TODO According to the README, there should be two other methods here,
  // api.changes.addListener and api.changes.removeListener.
  api._changes = function (opts) {
    // We internally page the results of a changes request, this means
    // if there is a large set of changes to be returned we can start
    // processing them quicker instead of waiting on the entire
    // set of changes to return and attempting to process them at once
    var batchSize = 'batch_size' in opts ? opts.batch_size : CHANGES_BATCH_SIZE;

    opts = utils.clone(opts);
    opts.timeout = opts.timeout || 30 * 1000;

    // We give a 5 second buffer for CouchDB changes to respond with
    // an ok timeout
    var params = { timeout: opts.timeout - (5 * 1000) };
    var limit = (typeof opts.limit !== 'undefined') ? opts.limit : false;
    if (limit === 0) {
      limit = 1;
    }
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }
    //
    var leftToFetch = limit;

    if (opts.style) {
      params.style = opts.style;
    }

    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params.include_docs = true;
    }

    if (opts.continuous) {
      params.feed = 'longpoll';
    }

    if (opts.conflicts) {
      params.conflicts = true;
    }

    if (opts.descending) {
      params.descending = true;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
      if (opts.filter === '_view' &&
          opts.view &&
          typeof opts.view === 'string') {
        params.view = opts.view;
      }
    }

    // If opts.query_params exists, pass it through to the changes request.
    // These parameters may be used by the filter on the source database.
    if (opts.query_params && typeof opts.query_params === 'object') {
      for (var param_name in opts.query_params) {
        if (opts.query_params.hasOwnProperty(param_name)) {
          params[param_name] = opts.query_params[param_name];
        }
      }
    }
    if (opts.continuous && api._useSSE) {
      return  api.sse(opts, params, returnDocs);
    }
    var xhr;
    var lastFetchedSeq;

    // Get all the changes starting wtih the one immediately after the
    // sequence number given by since.
    var fetch = function (since, callback) {
      if (opts.aborted) {
        return;
      }
      params.since = since;
      if (opts.descending) {
        if (limit) {
          params.limit = leftToFetch;
        }
      } else {
        params.limit = (!limit || leftToFetch > batchSize) ?
          batchSize : leftToFetch;
      }

      var paramStr = '?' + Object.keys(params).map(function (k) {
        return k + '=' + params[k];
      }).join('&');

      // Set the options for the ajax call
      var xhrOpts = {
        headers: host.headers,
        method: 'GET',
        url: genDBUrl(host, '_changes' + paramStr),
        // _changes can take a long time to generate, especially when filtered
        timeout: opts.timeout
      };
      lastFetchedSeq = since;

      if (opts.aborted) {
        return;
      }

      // Get the changes
      xhr = ajax(xhrOpts, callback);
    };

    // If opts.since exists, get all the changes from the sequence
    // number given by opts.since. Otherwise, get all the changes
    // from the sequence number 0.
    var fetchTimeout = 10;
    var fetchRetryCount = 0;

    var results = {results: []};

    var fetched = function (err, res) {
      if (opts.aborted) {
        return;
      }
      var raw_results_length = 0;
      // If the result of the ajax call (res) contains changes (res.results)
      if (res && res.results) {
        raw_results_length = res.results.length;
        results.last_seq = res.last_seq;
        // For each change
        var req = {};
        req.query = opts.query_params;
        res.results = res.results.filter(function (c) {
          leftToFetch--;
          var ret = utils.filterChange(opts)(c);
          if (ret) {
            if (returnDocs) {
              results.results.push(c);
            }
            utils.call(opts.onChange, c);
          }
          return ret;
        });
      } else if (err) {
        // In case of an error, stop listening for changes and call
        // opts.complete
        opts.aborted = true;
        utils.call(opts.complete, err);
        return;
      }

      // The changes feed may have timed out with no results
      // if so reuse last update sequence
      if (res && res.last_seq) {
        lastFetchedSeq = res.last_seq;
      }

      var finished = (limit && leftToFetch <= 0) ||
        (res && raw_results_length < batchSize) ||
        (opts.descending);

      if ((opts.continuous && !(limit && leftToFetch <= 0)) || !finished) {
        // Increase retry delay exponentially as long as errors persist
        if (err) {
          fetchRetryCount += 1;
        } else {
          fetchRetryCount = 0;
        }
        var timeoutMultiplier = 1 << fetchRetryCount;
        var retryWait = fetchTimeout * timeoutMultiplier;
        var maximumWait = opts.maximumWait || 30000;

        if (retryWait > maximumWait) {
          utils.call(opts.complete, err || errors.UNKNOWN_ERROR);
          return;
        }

        // Queue a call to fetch again with the newest sequence number
        setTimeout(function () { fetch(lastFetchedSeq, fetched); }, retryWait);
      } else {
        // We're done, call the callback
        utils.call(opts.complete, null, results);
      }
    };

    fetch(opts.since || 0, fetched);

    // Return a method to cancel this method from processing any more
    return {
      cancel: function () {
        opts.aborted = true;
        if (xhr) {
          xhr.abort();
        }
      }
    };
  };

  api.sse = function (opts, params, returnDocs) {
    params.feed = 'eventsource';
    params.since = opts.since || 0;
    params.limit = opts.limit;
    delete params.timeout;
    var paramStr = '?' + Object.keys(params).map(function (k) {
      return k + '=' + params[k];
    }).join('&');
    var url = genDBUrl(host, '_changes' + paramStr);
    var source = new EventSource(url);
    var results = {
      results: [],
      last_seq: false
    };
    var dispatched = false;
    var open = false;
    source.addEventListener('message', msgHandler, false);
    source.onopen = function () {
      open = true;
    };
    source.onerror = errHandler;
    return {
      cancel: function () {
        if (dispatched) {
          return dispatched.cancel();
        }
        source.removeEventListener('message', msgHandler, false);
        source.close();
      }
    };
    function msgHandler(e) {
      var data = JSON.parse(e.data);
      if (returnDocs) {
        results.results.push(data);
      }
      results.last_seq = data.seq;
      utils.call(opts.onChange, data);
    }
    function errHandler(err) {
      source.removeEventListener('message', msgHandler, false);
      if (open === false) {
        // errored before it opened
        // likely doesn't support EventSource
        api._useSSE = false;
        dispatched = api._changes(opts);
        return;
      }
      source.close();
      utils.call(opts.complete, err);
    }
    
  };

  api._useSSE = false;
  // Currently disabled due to failing chrome tests in saucelabs
  // api._useSSE = typeof global.EventSource === 'function';

  // Given a set of document/revision IDs (given by req), tets the subset of
  // those that do NOT correspond to revisions stored in the database.
  // See http://wiki.apache.org/couchdb/HttpPostRevsDiff
  api.revsDiff = utils.adapterFun('revsDiff', function (req, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    // Get the missing document/revision IDs
    ajax({
      headers: host.headers,
      method: 'POST',
      url: genDBUrl(host, '_revs_diff'),
      body: JSON.stringify(req)
    }, callback);
  });

  api._close = function (callback) {
    callback();
  };

  api.destroy = utils.adapterFun('destroy', function (callback) {
    ajax({
      url: genDBUrl(host, ''),
      method: 'DELETE',
      headers: host.headers
    }, function (err, resp) {
      if (err) {
        api.emit('error', err);
        callback(err);
      } else {
        api.emit('destroyed');
        callback(null, resp);
      }
    });
  });
}

// Delete the HttpPouch specified by the given name.
HttpPouch.destroy = utils.toPromise(function (name, opts, callback) {
  var host = getHost(name, opts);
  opts = opts || {};
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.clone(opts);
  opts.headers = host.headers;
  opts.method = 'DELETE';
  opts.url = genDBUrl(host, '');
  var ajaxOpts = opts.ajax || {};
  opts = utils.extend({}, opts, ajaxOpts);
  utils.ajax(opts, callback);
});

// HttpPouch is a valid adapter.
HttpPouch.valid = function () {
  return true;
};

module.exports = HttpPouch;

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"../deps/errors":12,"../utils":26,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31}],3:[function(_dereq_,module,exports){
(function (process,global){
'use strict';

var utils = _dereq_('../utils');
var merge = _dereq_('../merge');
var errors = _dereq_('../deps/errors');
var vuvuzela = _dereq_('vuvuzela');

var cachedDBs = {};
var taskQueue = {
  running: false,
  queue: []
};

function tryCode(fun, that, args) {
  try {
    fun.apply(that, args);
  } catch (err) { // shouldn't happen
    if (window.PouchDB) {
      window.PouchDB.emit('error', err);
    }
  }
}

function applyNext() {
  if (taskQueue.running || !taskQueue.queue.length) {
    return;
  }
  taskQueue.running = true;
  var item = taskQueue.queue.shift();
  item.action(function (err, res) {
    tryCode(item.callback, this, [err, res]);
    taskQueue.running = false;
    process.nextTick(applyNext);
  });
}

function idbError(callback) {
  return function (event) {
    var message = (event.target && event.target.error &&
      event.target.error.name) || event.target;
    callback(errors.error(errors.IDB_ERROR, message, event.type));
  };
}

// Unfortunately, the metadata has to be stringified
// when it is put into the database, because otherwise
// IndexedDB can throw errors for deeply-nested objects.
// Originally we just used JSON.parse/JSON.stringify; now
// we use this custom vuvuzela library that avoids recursion.
// If we could do it all over again, we'd probably use a
// format for the revision trees other than JSON.
function encodeMetadata(metadata, winningRev, deleted) {
  var storedObject = {data: vuvuzela.stringify(metadata)};
  storedObject.winningRev = winningRev;
  storedObject.deletedOrLocal = deleted ? '1' : '0';
  storedObject.id = metadata.id;
  return storedObject;
}

function decodeMetadata(storedObject) {
  if (!storedObject) {
    return null;
  }
  if (!storedObject.data) {
    // old format, when we didn't store it stringified
    return storedObject;
  }
  var metadata = vuvuzela.parse(storedObject.data);
  metadata.winningRev = storedObject.winningRev;
  metadata.deletedOrLocal = storedObject.deletedOrLocal === '1';
  return metadata;
}

function IdbPouch(opts, callback) {
  var api = this;

  taskQueue.queue.push({
    action: function (thisCallback) {
      init(api, opts, thisCallback);
    },
    callback: callback
  });
  applyNext();
}

function init(api, opts, callback) {

  // IndexedDB requires a versioned database structure, so we use the
  // version here to manage migrations.
  var ADAPTER_VERSION = 4;

  // The object stores created for each database
  // DOC_STORE stores the document meta data, its revision history and state
  // Keyed by document id
  var DOC_STORE = 'document-store';
  // BY_SEQ_STORE stores a particular version of a document, keyed by its
  // sequence id
  var BY_SEQ_STORE = 'by-sequence';
  // Where we store attachments
  var ATTACH_STORE = 'attach-store';
  // Where we store many-to-many relations
  // between attachment digests and seqs
  var ATTACH_AND_SEQ_STORE = 'attach-seq-store';

  // Where we store database-wide meta data in a single record
  // keyed by id: META_STORE
  var META_STORE = 'meta-store';
  // Where we store local documents
  var LOCAL_STORE = 'local-store';
  // Where we detect blob support
  var DETECT_BLOB_SUPPORT_STORE = 'detect-blob-support';

  var name = opts.name;

  var blobSupport = null;
  var instanceId = null;
  var idStored = false;
  var idb = null;
  var docCount = -1;

  // called when creating a fresh new database
  function createSchema(db) {
    var docStore = db.createObjectStore(DOC_STORE, {keyPath : 'id'});
    docStore.createIndex('seq', 'seq', {unique: true});
    db.createObjectStore(BY_SEQ_STORE, {autoIncrement: true})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
    db.createObjectStore(ATTACH_STORE, {keyPath: 'digest'});
    db.createObjectStore(META_STORE, {keyPath: 'id', autoIncrement: false});
    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);

    // added in v2
    docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

    // added in v3
    db.createObjectStore(LOCAL_STORE, {keyPath: '_id'})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});

    // added in v4
    var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
      {autoIncrement: true});
    attAndSeqStore.createIndex('seq', 'seq');
    attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
  }

  // migration to version 2
  // unfortunately "deletedOrLocal" is a misnomer now that we no longer
  // store local docs in the main doc-store, but whaddyagonnado
  function addDeletedOrLocalIndex(txn, callback) {
    var docStore = txn.objectStore(DOC_STORE);
    docStore.createIndex('deletedOrLocal', 'deletedOrLocal', {unique : false});

    docStore.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var deleted = utils.isDeleted(metadata);
        metadata.deletedOrLocal = deleted ? "1" : "0";
        docStore.put(metadata);
        cursor["continue"]();
      } else {
        callback();
      }
    };
  }

  // migrations to get to version 3

  function createLocalStoreSchema(db) {
    db.createObjectStore(LOCAL_STORE, {keyPath: '_id'})
      .createIndex('_doc_id_rev', '_doc_id_rev', {unique: true});
  }

  function migrateLocalStore(txn, cb) {
    var localStore = txn.objectStore(LOCAL_STORE);
    var docStore = txn.objectStore(DOC_STORE);
    var seqStore = txn.objectStore(BY_SEQ_STORE);

    var cursor = docStore.openCursor();
    cursor.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        var metadata = cursor.value;
        var docId = metadata.id;
        var local = utils.isLocalId(docId);
        var rev = merge.winningRev(metadata);
        if (local) {
          var docIdRev = docId + "::" + rev;
          // remove all seq entries
          // associated with this docId
          var start = docId + "::";
          var end = docId + "::~";
          var index = seqStore.index('_doc_id_rev');
          var range = global.IDBKeyRange.bound(start, end, false, false);
          var seqCursor = index.openCursor(range);
          seqCursor.onsuccess = function (e) {
            seqCursor = e.target.result;
            if (!seqCursor) {
              // done
              docStore["delete"](cursor.primaryKey);
              cursor["continue"]();
            } else {
              var data = seqCursor.value;
              if (data._doc_id_rev === docIdRev) {
                localStore.put(data);
              }
              seqStore["delete"](seqCursor.primaryKey);
              seqCursor["continue"]();
            }
          };
        } else {
          cursor["continue"]();
        }
      } else if (cb) {
        cb();
      }
    };
  }

  // migrations to get to version 4
  function addAttachAndSeqStore(db) {
    var attAndSeqStore = db.createObjectStore(ATTACH_AND_SEQ_STORE,
      {autoIncrement: true});
    attAndSeqStore.createIndex('seq', 'seq');
    attAndSeqStore.createIndex('digestSeq', 'digestSeq', {unique: true});
  }

  function migrateAttsAndSeqs(txn) {
    var seqStore = txn.objectStore(BY_SEQ_STORE);
    var attStore = txn.objectStore(ATTACH_STORE);
    var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);

    // need to actually populate the table. this is the expensive part,
    // so as an optimization, check first that this database even
    // contains attachments
    var req = attStore.count();
    req.onsuccess = function (e) {
      var count = e.target.result;
      if (!count) {
        return; // done
      }

      seqStore.openCursor().onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) {
          return; // done
        }
        var doc = cursor.value;
        var seq = cursor.primaryKey;
        var atts = Object.keys(doc._attachments || {});
        var digestMap = {};
        for (var j = 0; j < atts.length; j++) {
          var att = doc._attachments[atts[j]];
          digestMap[att.digest] = true; // uniq digests, just in case
        }
        var digests = Object.keys(digestMap);
        for (j = 0; j < digests.length; j++) {
          var digest = digests[j];
          attAndSeqStore.put({
            seq: seq,
            digestSeq: digest + '::' + seq
          });
        }
        cursor["continue"]();
      };
    };
  }

  api.type = function () {
    return 'idb';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._bulkDocs = function idb_bulkDocs(req, opts, callback) {
    var newEdits = opts.new_edits;
    var userDocs = req.docs;
    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      if (doc._id && utils.isLocalId(doc._id)) {
        return doc;
      }
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var results = new Array(docInfos.length);
    var fetchedDocs = new utils.Map();
    var preconditionErrored = false;

    function processDocs() {
      if (!docInfos.length) {
        return;
      }

      var idsToDocs = new utils.Map();

      docInfos.forEach(function (currentDoc, resultsIdx) {
        if (currentDoc._id && utils.isLocalId(currentDoc._id)) {
          api[currentDoc._deleted ? '_removeLocal' : '_putLocal'](
              currentDoc, {ctx: txn}, function (err, resp) {
            if (err) {
              results[resultsIdx] = err;
            } else {
              results[resultsIdx] = {};
            }
          });
          return;
        }

        var id = currentDoc.metadata.id;
        if (idsToDocs.has(id)) {
          idsToDocs.get(id).push([currentDoc, resultsIdx]);
        } else {
          idsToDocs.set(id, [[currentDoc, resultsIdx]]);
        }
      });

      // in the case of new_edits, the user can provide multiple docs
      // with the same id. these need to be processed sequentially
      idsToDocs.forEach(function (docs, id) {
        var numDone = 0;

        function docWritten() {
          if (++numDone < docs.length) {
            nextDoc();
          }
        }
        function nextDoc() {
          var value = docs[numDone];
          var currentDoc = value[0];
          var resultsIdx = value[1];

          if (fetchedDocs.has(id)) {
            updateDoc(fetchedDocs.get(id), currentDoc, resultsIdx, docWritten);
          } else {
            insertDoc(currentDoc, resultsIdx, docWritten);
          }
        }
        nextDoc();
      });
    }

    function fetchExistingDocs(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var numFetched = 0;

      function checkDone() {
        if (++numFetched === docInfos.length) {
          callback();
        }
      }

      docInfos.forEach(function (docInfo) {
        if (docInfo._id && utils.isLocalId(docInfo._id)) {
          return checkDone(); // skip local docs
        }
        var id = docInfo.metadata.id;
        var req = txn.objectStore(DOC_STORE).get(id);
        req.onsuccess = function process_docRead(event) {
          var metadata = decodeMetadata(event.target.result);
          if (metadata) {
            fetchedDocs.set(id, metadata);
          }
          checkDone();
        };
      });
    }

    function complete() {
      if (preconditionErrored) {
        return;
      }
      var aresults = results.map(function (result) {
        if (result._bulk_seq) {
          delete result._bulk_seq;
        } else if (!Object.keys(result).length) {
          return {
            ok: true
          };
        }
        if (result.error) {
          return result;
        }

        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        return {
          ok: true,
          id: metadata.id,
          rev: rev
        };
      });
      IdbPouch.Changes.notify(name);
      docCount = -1; // invalidate
      callback(null, aresults);
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        var data;
        try {
          data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        var length;
        if (blobSupport) {
          var type = att.content_type;
          data = utils.fixBinary(data);
          length = data.byteLength;
          att.data = utils.createBlob([data], {type: type});
        } else {
          length = data.length;
        }
        utils.MD5(data).then(function (result) {
          att.digest = 'md5-' + result;
          att.length = length;
          finish();
        });
        return;
      }
      utils.readAsBinaryString(att.data, function (binary) {
        if (!blobSupport) {
          att.data = btoa(binary);
        }
        utils.MD5(binary).then(function (result) {
          att.digest = 'md5-' + result;
          att.length = binary.length;
          finish();
        });
      });
    }

    function verifyAttachment(digest, callback) {
      var req = txn.objectStore([ATTACH_STORE]).get(digest);
      req.onsuccess = function (e) {
        if (!e.target.result) {
          var err = new Error('unknown stub attachment with digest ' + digest);
          err.status = 412;
          callback(err);
        } else {
          callback();
        }
      };
    }

    function verifyAttachments(finish) {
      var digests = [];
      docInfos.forEach(function (docInfo) {
        if (docInfo.data && docInfo.data._attachments) {
          Object.keys(docInfo.data._attachments).forEach(function (filename) {
            var att = docInfo.data._attachments[filename];
            if (att.stub) {
              digests.push(att.digest);
            }
          });
        }
      });
      if (!digests.length) {
        return finish();
      }
      var numDone = 0;
      var err;

      function checkDone() {
        if (++numDone === digests.length) {
          finish(err);
        }
      }
      digests.forEach(function (digest) {
        verifyAttachment(digest, function (attErr) {
          if (attErr && !err) {
            err = attErr;
          }
          checkDone();
        });
      });
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;
      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];

        if (!attachments.length) {
          return done();
        }

        var recv = 0;
        function attachmentProcessed() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 attachmentProcessed);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, winningRev, deleted, callback, resultsIdx) {
      var err = null;
      var recv = 0;
      var id = docInfo.data._id = docInfo.metadata.id;
      var rev = docInfo.data._rev = docInfo.metadata.rev;
      var docIdRev = id + "::" + rev;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      // map seqs to attachment digests, which
      // we will need later during compaction
      function insertAttachmentMappings(seq, callback) {
        var attsAdded = 0;
        var attsToAdd = Object.keys(docInfo.data._attachments || {});

        if (!attsToAdd.length) {
          return callback();
        }
        function checkDone() {
          if (++attsAdded === attsToAdd.length) {
            callback();
          }
        }
        function add(att) {
          var digest = docInfo.data._attachments[att].digest;
          var req = txn.objectStore(ATTACH_AND_SEQ_STORE).put({
            seq: seq,
            digestSeq: digest + '::' + seq
          });

          req.onsuccess = checkDone;
          req.onerror = function (e) {
            // this callback is for a constaint error, which we ignore
            // because this docid/rev has already been associated with
            // the digest (e.g. when new_edits == false)
            e.preventDefault(); // avoid transaction abort
            e.stopPropagation(); // avoid transaction onerror
            checkDone();
          };
        }
        for (var i = 0; i < attsToAdd.length; i++) {
          add(attsToAdd[i]); // do in parallel
        }
      }

      function finish() {
        docInfo.data._doc_id_rev = docIdRev;
        var seqStore = txn.objectStore(BY_SEQ_STORE);
        var index = seqStore.index('_doc_id_rev');

        function afterPut(e) {
          var metadata = docInfo.metadata;
          var seq = e.target.result;
          metadata.seq = seq;
          // Current _rev is calculated from _rev_tree on read
          delete metadata.rev;
          var metadataToStore = encodeMetadata(metadata, winningRev, deleted);
          var metaDataReq = txn.objectStore(DOC_STORE).put(metadataToStore);
          metaDataReq.onsuccess = function () {
            delete metadata.deletedOrLocal;
            delete metadata.winningRev;
            results[resultsIdx] = docInfo;
            fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
            insertAttachmentMappings(seq, function () {
              utils.call(callback);
            });
          };
        }

        var putReq = seqStore.put(docInfo.data);

        putReq.onsuccess = afterPut;
        putReq.onerror = function (e) {
          // ConstraintError, need to update, not put (see #1638 for details)
          e.preventDefault(); // avoid transaction abort
          e.stopPropagation(); // avoid transaction onerror
          var getKeyReq = index.getKey(docInfo.data._doc_id_rev);
          getKeyReq.onsuccess = function (e) {
            var putReq = seqStore.put(docInfo.data, e.target.result);
            putReq.onsuccess = afterPut;
          };
        };
      }

      if (!attachments.length) {
        finish();
      }
    }

    function updateDoc(oldDoc, docInfo, resultsIdx, callback) {

      if (utils.revExists(oldDoc, docInfo.metadata.rev)) {
        results[resultsIdx] = docInfo;
        callback();
        return;
      }

      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var previouslyDeleted = utils.isDeleted(oldDoc);
      var deleted = utils.isDeleted(docInfo.metadata);
      var inConflict = (previouslyDeleted && deleted && newEdits) ||
        (!previouslyDeleted && newEdits && merged.conflicts !== 'new_leaf') ||
        (previouslyDeleted && !deleted && merged.conflicts === 'new_branch');

      if (inConflict) {
        results[resultsIdx] = makeErr(errors.REV_CONFLICT, docInfo._bulk_seq);
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;

      // recalculate
      var winningRev = merge.winningRev(docInfo.metadata);
      deleted = utils.isDeleted(docInfo.metadata, winningRev);

      writeDoc(docInfo, winningRev, deleted, callback, resultsIdx);
    }

    function insertDoc(docInfo, resultsIdx, callback) {
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);
      // Cant insert new deleted documents
      if ('was_delete' in opts && deleted) {
        results[resultsIdx] = errors.MISSING_DOC;
        return callback();
      }

      writeDoc(docInfo, winningRev, deleted, callback, resultsIdx);
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(digest, data, callback) {
      var objectStore = txn.objectStore(ATTACH_STORE);
      objectStore.get(digest).onsuccess = function (e) {
        var exists = e.target.result;
        if (exists) {
          // don't bother re-putting if it already exists
          return utils.call(callback);
        }
        var newAtt = {
          digest: digest,
          body: data
        };
        objectStore.put(newAtt).onsuccess = function () {
          utils.call(callback);
        };
      };
    }

    var txn;
    preprocessAttachments(function () {
      var stores = [
        DOC_STORE, BY_SEQ_STORE,
        ATTACH_STORE, META_STORE,
        LOCAL_STORE, ATTACH_AND_SEQ_STORE
      ];
      txn = idb.transaction(stores, 'readwrite');
      txn.onerror = idbError(callback);
      txn.ontimeout = idbError(callback);
      txn.oncomplete = complete;

      verifyAttachments(function (err) {
        if (err) {
          preconditionErrored = true;
          return callback(err);
        }
        fetchExistingDocs(processDocs);
      });
    });
  };

  // First we look up the metadata in the ids database, then we fetch the
  // current revision(s) from the by sequence store
  api._get = function idb_get(id, opts, callback) {
    var doc;
    var metadata;
    var err;
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: txn});
    }

    txn.objectStore(DOC_STORE).get(id).onsuccess = function (e) {
      metadata = decodeMetadata(e.target.result);
      // we can determine the result here if:
      // 1. there is no such document
      // 2. the document is deleted and we don't ask about specific rev
      // When we ask with opts.rev we expect the answer to be either
      // doc (possibly with _deleted=true) or missing error
      if (!metadata) {
        err = errors.MISSING_DOC;
        return finish();
      }
      if (utils.isDeleted(metadata) && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, "deleted");
        return finish();
      }
      var objectStore = txn.objectStore(BY_SEQ_STORE);

      // metadata.winningRev was added later, so older DBs might not have it
      var rev = opts.rev || metadata.winningRev || merge.winningRev(metadata);
      var key = metadata.id + '::' + rev;

      objectStore.index('_doc_id_rev').get(key).onsuccess = function (e) {
        doc = e.target.result;
        if (doc && doc._doc_id_rev) {
          delete(doc._doc_id_rev);
        }
        if (!doc) {
          err = errors.MISSING_DOC;
          return finish();
        }
        finish();
      };
    };
  };

  api._getAttachment = function (attachment, opts, callback) {
    var txn;
    opts = utils.clone(opts);
    if (opts.ctx) {
      txn = opts.ctx;
    } else {
      txn =
        idb.transaction([DOC_STORE, BY_SEQ_STORE, ATTACH_STORE], 'readonly');
    }
    var digest = attachment.digest;
    var type = attachment.content_type;

    txn.objectStore(ATTACH_STORE).get(digest).onsuccess = function (e) {
      var data = e.target.result.body;
      if (opts.encode) {
        if (!data) {
          callback(null, '');
        } else if (typeof data !== 'string') { // we have blob support
          utils.readAsBinaryString(data, function (binary) {
            callback(null, btoa(binary));
          });
        } else { // no blob support
          callback(null, data);
        }
      } else {
        if (!data) {
          callback(null, utils.createBlob([''], {type: type}));
        } else if (typeof data !== 'string') { // we have blob support
          callback(null, data);
        } else { // no blob support
          data = utils.fixBinary(atob(data));
          callback(null, utils.createBlob([data], {type: type}));
        }
      }
    };
  };

  function allDocsQuery(totalRows, opts, callback) {
    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var skip = opts.skip || 0;
    var limit = typeof opts.limit === 'number' ? opts.limit : -1;
    var inclusiveEnd = opts.inclusive_end !== false;
    var descending = 'descending' in opts && opts.descending ? 'prev' : null;

    var manualDescEnd = false;
    if (descending && start && end) {
      // unfortunately IDB has a quirk where IDBKeyRange.bound is invalid if the
      // start is less than the end, even in descending mode.  Best bet
      // is just to handle it manually in that case.
      manualDescEnd = end;
      end = false;
    }

    var keyRange = null;
    try {
      if (start && end) {
        keyRange = global.IDBKeyRange.bound(start, end, false, !inclusiveEnd);
      } else if (start) {
        if (descending) {
          keyRange = global.IDBKeyRange.upperBound(start);
        } else {
          keyRange = global.IDBKeyRange.lowerBound(start);
        }
      } else if (end) {
        if (descending) {
          keyRange = global.IDBKeyRange.lowerBound(end, !inclusiveEnd);
        } else {
          keyRange = global.IDBKeyRange.upperBound(end, !inclusiveEnd);
        }
      } else if (key) {
        keyRange = global.IDBKeyRange.only(key);
      }
    } catch (e) {
      if (e.name === "DataError" && e.code === 0) {
        // data error, start is less than end
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      } else {
        return callback(errors.error(errors.IDB_ERROR, e.name, e.message));
      }
    }

    var transaction = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
    transaction.oncomplete = function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    };

    var oStore = transaction.objectStore(DOC_STORE);
    var oCursor = descending ? oStore.openCursor(keyRange, descending)
      : oStore.openCursor(keyRange);
    var results = [];
    oCursor.onsuccess = function (e) {
      if (!e.target.result) {
        return;
      }
      var cursor = e.target.result;
      var metadata = decodeMetadata(cursor.value);
      // metadata.winningRev added later, some dbs might be missing it
      var winningRev = metadata.winningRev || merge.winningRev(metadata);

      function allDocsInner(metadata, data) {
        var doc = {
          id: metadata.id,
          key: metadata.id,
          value: {
            rev: winningRev
          }
        };
        if (opts.include_docs) {
          doc.doc = data;
          doc.doc._rev = winningRev;
          if (doc.doc._doc_id_rev) {
            delete(doc.doc._doc_id_rev);
          }
          if (opts.conflicts) {
            doc.doc._conflicts = merge.collectConflicts(metadata);
          }
          for (var att in doc.doc._attachments) {
            if (doc.doc._attachments.hasOwnProperty(att)) {
              doc.doc._attachments[att].stub = true;
            }
          }
        }
        var deleted = utils.isDeleted(metadata, winningRev);
        if (opts.deleted === 'ok') {
          // deleted docs are okay with keys_requests
          if (deleted) {
            doc.value.deleted = true;
            doc.doc = null;
          }
          results.push(doc);
        } else if (!deleted && skip-- <= 0) {
          if (manualDescEnd) {
            if (inclusiveEnd && doc.key < manualDescEnd) {
              return;
            } else if (!inclusiveEnd && doc.key <= manualDescEnd) {
              return;
            }
          }
          results.push(doc);
          if (--limit === 0) {
            return;
          }
        }
        cursor["continue"]();
      }

      if (!opts.include_docs) {
        allDocsInner(metadata);
      } else {
        var index = transaction.objectStore(BY_SEQ_STORE).index('_doc_id_rev');
        var key = metadata.id + "::" + winningRev;
        index.get(key).onsuccess = function (event) {
          allDocsInner(decodeMetadata(cursor.value), event.target.result);
        };
      }
    };
  }

  function countDocs(callback) {
    if (docCount !== -1) {
      return callback(null, docCount);
    }

    var count;
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var index = txn.objectStore(DOC_STORE).index('deletedOrLocal');
    index.count(global.IDBKeyRange.only("0")).onsuccess = function (e) {
      count = e.target.result;
    };
    txn.onerror = idbError(callback);
    txn.oncomplete = function () {
      docCount = count;
      callback(null, docCount);
    };
  }

  api._allDocs = function idb_allDocs(opts, callback) {

    // first count the total_rows
    countDocs(function (err, totalRows) {
      if (err) {
        return callback(err);
      }
      if (opts.limit === 0) {
        return callback(null, {
          total_rows : totalRows,
          offset : opts.skip,
          rows : []
        });
      }
      allDocsQuery(totalRows, opts, callback);
    });
  };

  api._info = function idb_info(callback) {

    countDocs(function (err, count) {
      if (err) {
        return callback(err);
      }
      if (idb === null) {
        var error = new Error('db isn\'t open');
        error.id = 'idbNull';
        return callback(error);
      }
      var updateSeq = 0;
      var txn = idb.transaction([BY_SEQ_STORE], 'readonly');
      txn.objectStore(BY_SEQ_STORE).openCursor(null, "prev").onsuccess =
        function (event) {
        var cursor = event.target.result;
        if (cursor) {
          updateSeq = cursor.key;
        } else {
          updateSeq = 0;
        }
      };

      txn.oncomplete = function () {
        callback(null, {
          doc_count: count,
          update_seq: updateSeq
        });
      };
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      IdbPouch.Changes.addListener(name, id, api, opts);
      IdbPouch.Changes.notify(name);
      return {
        cancel: function () {
          IdbPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending ? 'prev' : null;
    var lastSeq = 0;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }
    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }

    var results = [];
    var numResults = 0;
    var filter = utils.filterChange(opts);

    var txn;

    function fetchChanges() {
      txn = idb.transaction([DOC_STORE, BY_SEQ_STORE], 'readonly');
      txn.oncomplete = onTxnComplete;

      var req;

      if (descending) {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true),
                        descending);
      } else {
        req = txn.objectStore(BY_SEQ_STORE)
            .openCursor(global.IDBKeyRange.lowerBound(opts.since, true));
      }

      req.onsuccess = onsuccess;
      req.onerror = onerror;
    }

    fetchChanges();

    function onsuccess(event) {
      var cursor = event.target.result;

      if (!cursor) {
        return;
      }

      var doc = cursor.value;

      if (opts.doc_ids && opts.doc_ids.indexOf(doc._id) === -1) {
        return cursor["continue"]();
      }

      var index = txn.objectStore(DOC_STORE);
      index.get(doc._id).onsuccess = function (event) {
        var metadata = decodeMetadata(event.target.result);

        if (lastSeq < metadata.seq) {
          lastSeq = metadata.seq;
        }
        // metadata.winningRev was only added later
        var winningRev = metadata.winningRev || merge.winningRev(metadata);
        if (doc._rev !== winningRev) {
          return cursor["continue"]();
        }

        delete doc['_doc_id_rev'];

        var change = opts.processChange(doc, metadata, opts);
        change.seq = cursor.key;
        if (filter(change)) {
          numResults++;
          if (returnDocs) {
            results.push(change);
          }
          opts.onChange(change);
        }
        if (numResults !== limit) {
          cursor["continue"]();
        }
      };
    }

    function onTxnComplete() {
      if (!opts.continuous) {
        opts.complete(null, {
          results: results,
          last_seq: lastSeq
        });
      }
    }
  };

  api._close = function (callback) {
    if (idb === null) {
      return callback(errors.NOT_OPEN);
    }

    // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBDatabase#close
    // "Returns immediately and closes the connection in a separate thread..."
    idb.close();
    delete cachedDBs[name];
    idb = null;
    callback();
  };

  api._getRevisionTree = function (docId, callback) {
    var txn = idb.transaction([DOC_STORE], 'readonly');
    var req = txn.objectStore(DOC_STORE).get(docId);
    req.onsuccess = function (event) {
      var doc = decodeMetadata(event.target.result);
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        callback(null, doc.rev_tree);
      }
    };
  };

  // This function removes revisions of document docId
  // which are listed in revs and sets this document
  // revision to to rev_tree
  api._doCompaction = function (docId, revs, callback) {
    var txn = idb.transaction([
      DOC_STORE,
      BY_SEQ_STORE,
      ATTACH_STORE,
      ATTACH_AND_SEQ_STORE
    ], 'readwrite');

    var docStore = txn.objectStore(DOC_STORE);
    var seqStore = txn.objectStore(BY_SEQ_STORE);
    var attStore = txn.objectStore(ATTACH_STORE);
    var attAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);

    var possiblyOrphanedDigests = [];

    function deleteOrphanedAttachments() {
      if (!possiblyOrphanedDigests.length) {
        return;
      }
      possiblyOrphanedDigests.forEach(function (digest) {
        var countReq = attAndSeqStore.index('digestSeq').count(
          global.IDBKeyRange.bound(
            digest + '::', digest + '::\uffff', false, false));
        countReq.onsuccess = function (e) {
          var count = e.target.result;
          if (!count) {
            // orphaned
            attStore["delete"](digest);
          }
        };
      });
    }

    docStore.get(docId).onsuccess = function (event) {
      var metadata = decodeMetadata(event.target.result);
      merge.traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                         revHash, ctx, opts) {
        var rev = pos + '-' + revHash;
        if (revs.indexOf(rev) !== -1) {
          opts.status = 'missing';
        }
      });

      var count = revs.length;
      revs.forEach(function (rev) {
        var index = seqStore.index('_doc_id_rev');
        var key = docId + "::" + rev;
        index.getKey(key).onsuccess = function (e) {
          var seq = e.target.result;
          if (typeof seq !== 'number') {
            return;
          }
          seqStore["delete"](seq);

          var cursor = attAndSeqStore.index('seq')
            .openCursor(global.IDBKeyRange.only(seq));

          cursor.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
              var digest = cursor.value.digestSeq.split('::')[0];
              possiblyOrphanedDigests.push(digest);
              attAndSeqStore["delete"](cursor.primaryKey);
              cursor["continue"]();
            } else { // done
              count--;
              if (!count) { // done processing all revs
                // winningRev is not guaranteed to be there, since it's
                // not formally migrated. deletedOrLocal is a
                // now-unfortunate name that really just means "deleted"
                var winningRev = metadata.winningRev ||
                  merge.winningRev(metadata);
                var deleted = metadata.deletedOrLocal;
                txn.objectStore(DOC_STORE).put(
                  encodeMetadata(metadata, winningRev, deleted));
                deleteOrphanedAttachments();
              }
            }
          };
        };
      });
    };
    txn.onerror = idbError(callback);
    txn.oncomplete = function () {
      utils.call(callback);
    };
  };


  api._getLocal = function (id, callback) {
    var tx = idb.transaction([LOCAL_STORE], 'readonly');
    var req = tx.objectStore(LOCAL_STORE).get(id);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var doc = e.target.result;
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        delete doc['_doc_id_rev'];
        callback(null, doc);
      }
    };
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    if (!oldRev) {
      doc._rev = '0-1';
    } else {
      doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }
    doc._doc_id_rev = id + '::' + doc._rev;

    var tx = opts.ctx;
    var ret;
    if (!tx) {
      tx = idb.transaction([LOCAL_STORE], 'readwrite');
      tx.onerror = idbError(callback);
      tx.oncomplete = function () {
        if (ret) {
          callback(null, ret);
        }
      };
    }

    var oStore = tx.objectStore(LOCAL_STORE);
    var req;
    if (oldRev) {
      var index = oStore.index('_doc_id_rev');
      var docIdRev = id + '::' + oldRev;
      req = index.get(docIdRev);
      req.onsuccess = function (e) {
        if (!e.target.result) {
          callback(errors.REV_CONFLICT);
        } else { // update
          var req = oStore.put(doc);
          req.onsuccess = function () {
            ret = {ok: true, id: doc._id, rev: doc._rev};
            if (opts.ctx) { // retuthis.immediately
              callback(null, ret);
            }
          };
        }
      };
    } else { // new doc
      req = oStore.get(id);
      req.onsuccess = function (e) {
        if (e.target.result) { // already exists
          callback(errors.REV_CONFLICT);
        } else { // insert
          var req = oStore.put(doc);
          req.onsuccess = function () {
            ret = {ok: true, id: doc._id, rev: doc._rev};
            if (opts.ctx) { // return immediately
              callback(null, ret);
            }
          };
        }
      };
    }
  };

  api._removeLocal = function (doc, callback) {
    var tx = idb.transaction([LOCAL_STORE], 'readwrite');
    var ret;
    tx.oncomplete = function () {
      if (ret) {
        callback(null, ret);
      }
    };
    var docIdRev = doc._id + '::' + doc._rev;
    var oStore = tx.objectStore(LOCAL_STORE);
    var index = oStore.index('_doc_id_rev');
    var req = index.get(docIdRev);

    req.onerror = idbError(callback);
    req.onsuccess = function (e) {
      var doc = e.target.result;
      if (!doc) {
        callback(errors.MISSING_DOC);
      } else {
        var req = index.getKey(docIdRev);
        req.onsuccess = function (e) {
          var key = e.target.result;
          oStore["delete"](key);
          ret = {ok: true, id: doc._id, rev: '0-0'};
        };
      }
    };
  };

  var cached = cachedDBs[name];

  if (cached) {
    idb = cached.idb;
    blobSupport = cached.blobSupport;
    instanceId = cached.instanceId;
    idStored = cached.idStored;
    process.nextTick(function () {
      callback(null, api);
    });
    return;
  }

  var req = global.indexedDB.open(name, ADAPTER_VERSION);

  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.openReqList[name] = req;

  req.onupgradeneeded = function (e) {
    var db = e.target.result;
    if (e.oldVersion < 1) {
      createSchema(db); // new db, initial schema
      return;
    }
    // promises would be great here, IndexedDB. >_<
    var txn = e.currentTarget.transaction;
    if (e.oldVersion < 4) {
      addAttachAndSeqStore(db); // v4
      if (e.oldVersion < 3) {
        createLocalStoreSchema(db); // v3
        if (e.oldVersion < 2) {
          addDeletedOrLocalIndex(txn, function () { // v2
            migrateLocalStore(txn, function () { // v3
              migrateAttsAndSeqs(txn); // v4
            });
          });
        } else {
          migrateLocalStore(txn, function () { // v3
            migrateAttsAndSeqs(txn); // v4
          });
        }
      } else {
        migrateAttsAndSeqs(txn); // v4
      }
    }
  };

  req.onsuccess = function (e) {

    idb = e.target.result;

    idb.onversionchange = function () {
      idb.close();
      delete cachedDBs[name];
    };
    idb.onabort = function () {
      idb.close();
      delete cachedDBs[name];
    };

    var txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
      'readwrite');

    var req = txn.objectStore(META_STORE).get(META_STORE);

    req.onsuccess = function (e) {

      var checkSetupComplete = function () {
        if (blobSupport === null || !idStored) {
          return;
        } else {
          cachedDBs[name] = {
            idb: idb,
            blobSupport: blobSupport,
            instanceId: instanceId,
            idStored: idStored,
            loaded: true
          };
          callback(null, api);
        }
      };

      var meta = e.target.result || {id: META_STORE};
      if (name  + '_id' in meta) {
        instanceId = meta[name + '_id'];
        idStored = true;
        checkSetupComplete();
      } else {
        instanceId = utils.uuid();
        meta[name + '_id'] = instanceId;
        txn.objectStore(META_STORE).put(meta).onsuccess = function () {
          idStored = true;
          checkSetupComplete();
        };
      }

      // Detect blob support. Chrome didn't support it until version 38.
      // in version 37 they had a broken version where PNGs (and possibly
      // other binary types) aren't stored correctly.
      try {
        var blob = utils.createBlob([''], {type: 'image/png'});
        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
        txn.oncomplete = function () {
          // have to do it in a separate transaction, else the correct
          // content type is always returned
          txn = idb.transaction([META_STORE, DETECT_BLOB_SUPPORT_STORE],
            'readwrite');
          var getBlobReq = txn.objectStore(
            DETECT_BLOB_SUPPORT_STORE).get('key');
          getBlobReq.onsuccess = function (e) {
            var storedBlob = e.target.result;
            var url = URL.createObjectURL(storedBlob);
            utils.ajax({
              url: url,
              cache: true,
              binary: true
            }, function (err, res) {
              if (err && err.status === 405) {
                // firefox won't let us do that. but firefox doesn't
                // have the blob type bug that Chrome does, so that's ok
                blobSupport = true;
              } else {
                blobSupport = !!(res && res.type === 'image/png');
                if (err && err.status === 404) {
                  utils.explain404(
                    'PouchDB is just detecting blob URL support.');
                }
              }
              URL.revokeObjectURL(url);
              checkSetupComplete();
            });
          };
        };
      } catch (err) {
        blobSupport = false;
        checkSetupComplete();
      }
    };
  };

  req.onerror = idbError(callback);

}

IdbPouch.valid = function () {
  // Issue #2533, we finally gave up on doing bug
  // detection instead of browser sniffing. Safari brought us
  // to our knees.
  var isSafari = typeof openDatabase !== 'undefined' &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent);

  // some outdated implementations of IDB that appear on Samsung
  // and HTC Android devices <4.4 are missing IDBKeyRange
  return !isSafari && global.indexedDB && global.IDBKeyRange;
};

function destroy(name, opts, callback) {
  if (!('openReqList' in IdbPouch)) {
    IdbPouch.openReqList = {};
  }
  IdbPouch.Changes.removeAllListeners(name);

  //Close open request for "name" database to fix ie delay.
  if (IdbPouch.openReqList[name] && IdbPouch.openReqList[name].result) {
    IdbPouch.openReqList[name].result.close();
  }
  var req = global.indexedDB.deleteDatabase(name);

  req.onsuccess = function () {
    //Remove open request from the list.
    if (IdbPouch.openReqList[name]) {
      IdbPouch.openReqList[name] = null;
    }
    if (utils.hasLocalStorage() && (name in global.localStorage)) {
      delete global.localStorage[name];
    }
    delete cachedDBs[name];
    callback(null, { 'ok': true });
  };

  req.onerror = idbError(callback);
}

IdbPouch.destroy = utils.toPromise(function (name, opts, callback) {
  taskQueue.queue.push({
    action: function (thisCallback) {
      destroy(name, opts, thisCallback);
    },
    callback: callback
  });
  applyNext();
});

IdbPouch.Changes = new utils.Changes();

module.exports = IdbPouch;

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../deps/errors":12,"../merge":21,"../utils":26,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"vuvuzela":61}],4:[function(_dereq_,module,exports){
module.exports = ['idb', 'websql'];
},{}],5:[function(_dereq_,module,exports){
(function (global){
'use strict';

var utils = _dereq_('../utils');
var merge = _dereq_('../merge');
var errors = _dereq_('../deps/errors');
var vuvuzela = _dereq_('vuvuzela');
var parseHexString = _dereq_('../deps/parse-hex');

function quote(str) {
  return "'" + str + "'";
}

// escapeBlob and unescapeBlob are workarounds for a websql bug:
// https://code.google.com/p/chromium/issues/detail?id=422690
// https://bugs.webkit.org/show_bug.cgi?id=137637
// The goal is to never actually insert the \u0000 character
// in the database.
function escapeBlob(str) {
  return str
    .replace(/\u0002/g, '\u0002\u0002')
    .replace(/\u0001/g, '\u0001\u0002')
    .replace(/\u0000/g, '\u0001\u0001');
}

function unescapeBlob(str) {
  return str
    .replace(/\u0001\u0001/g, '\u0000')
    .replace(/\u0001\u0002/g, '\u0001')
    .replace(/\u0002\u0002/g, '\u0002');
}

var cachedDatabases = {};

var openDB = utils.getArguments(function (args) {
  if (typeof global !== 'undefined') {
    if (global.navigator && global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return navigator.sqlitePlugin.openDatabase
        .apply(navigator.sqlitePlugin, args);
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return global.sqlitePlugin.openDatabase
        .apply(global.sqlitePlugin, args);
    } else {
      var db = cachedDatabases[args[0]];
      if (!db) {
        db = cachedDatabases[args[0]] =
          global.openDatabase.apply(global, args);
      }
      return db;
    }
  }
});

var POUCH_VERSION = 1;
var ADAPTER_VERSION = 6; // used to manage migrations

// The object stores created for each database
// DOC_STORE stores the document meta data, its revision history and state
var DOC_STORE = quote('document-store');
// BY_SEQ_STORE stores a particular version of a document, keyed by its
// sequence id
var BY_SEQ_STORE = quote('by-sequence');
// Where we store attachments
var ATTACH_STORE = quote('attach-store');
var LOCAL_STORE = quote('local-store');
var META_STORE = quote('metadata-store');
// where we store many-to-many relations between attachment
// digests and seqs
var ATTACH_AND_SEQ_STORE = quote('attach-seq-store');

// these indexes cover the ground for most allDocs queries
var BY_SEQ_STORE_DELETED_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'by-seq-deleted-idx\' ON ' +
  BY_SEQ_STORE + ' (seq, deleted)';
var BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS \'by-seq-doc-id-rev\' ON ' +
    BY_SEQ_STORE + ' (doc_id, rev)';
var DOC_STORE_WINNINGSEQ_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'doc-winningseq-idx\' ON ' +
  DOC_STORE + ' (winningseq)';
var ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS \'attach-seq-seq-idx\' ON ' +
    ATTACH_AND_SEQ_STORE + ' (seq)';
var ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS \'attach-seq-digest-idx\' ON ' +
    ATTACH_AND_SEQ_STORE + ' (digest, seq)';

var DOC_STORE_AND_BY_SEQ_JOINER = BY_SEQ_STORE +
  '.seq = ' + DOC_STORE + '.winningseq';

var SELECT_DOCS = BY_SEQ_STORE + '.seq AS seq, ' +
  BY_SEQ_STORE + '.deleted AS deleted, ' +
  BY_SEQ_STORE + '.json AS data, ' +
  BY_SEQ_STORE + '.rev AS rev, ' +
  DOC_STORE + '.json AS metadata';

function select(selector, table, joiner, where, orderBy) {
  return 'SELECT ' + selector + ' FROM ' +
    (typeof table === 'string' ? table : table.join(' JOIN ')) +
    (joiner ? (' ON ' + joiner) : '') +
    (where ? (' WHERE ' +
      (typeof where === 'string' ? where : where.join(' AND '))) : '') +
    (orderBy ? (' ORDER BY ' + orderBy) : '');
}

function unknownError(callback) {
  return function (event) {
    // event may actually be a SQLError object, so report is as such
    var errorNameMatch = event && event.constructor.toString()
      .match(/function ([^\(]+)/);
    var errorName = (errorNameMatch && errorNameMatch[1]) || event.type;
    var errorReason = event.target || event.message;
    callback(errors.error(errors.WSQ_ERROR, errorReason, errorName));
  };
}

function stringifyDoc(doc) {
  // don't bother storing the id/rev. it uses lots of space,
  // in persistent map/reduce especially
  delete doc._id;
  delete doc._rev;
  return JSON.stringify(doc);
}

function unstringifyDoc(doc, id, rev) {
  doc = JSON.parse(doc);
  doc._id = id;
  doc._rev = rev;
  return doc;
}

function getSize(opts) {
  if ('size' in opts) {
    // triggers immediate popup in iOS, fixes #2347
    // e.g. 5000001 asks for 5 MB, 10000001 asks for 10 MB,
    return opts.size * 1000000;
  }
  // In iOS, doesn't matter as long as it's <= 5000000.
  // Except that if you request too much, our tests fail
  // because of the native "do you accept?" popup.
  // In Android <=4.3, this value is actually used as an
  // honest-to-god ceiling for data, so we need to
  // set it to a decently high number.
  var isAndroid = /Android/.test(window.navigator.userAgent);
  return isAndroid ? 5000000 : 1; // in PhantomJS, if you use 0 it will crash
}

function WebSqlPouch(opts, callback) {
  var api = this;
  var instanceId = null;
  var name = opts.name;
  var size = getSize(opts);
  var idRequests = [];
  var docCount = -1; // cache sqlite count(*) for performance
  var encoding;

  var db = openDB(name, POUCH_VERSION, name, size);
  if (!db) {
    return callback(errors.UNKNOWN_ERROR);
  } else if (typeof db.readTransaction !== 'function') {
    // doesn't exist in sqlite plugin
    db.readTransaction = db.transaction;
  }

  function dbCreated() {
    // note the db name in case the browser upgrades to idb
    if (utils.hasLocalStorage()) {
      global.localStorage['_pouch__websqldb_' + name] = true;
    }
    callback(null, api);
  }

  // In this migration, we added the 'deleted' and 'local' columns to the
  // by-seq and doc store tables.
  // To preserve existing user data, we re-process all the existing JSON
  // and add these values.
  // Called migration2 because it corresponds to adapter version (db_version) #2
  function runMigration2(tx, callback) {
    // index used for the join in the allDocs query
    tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);

    tx.executeSql('ALTER TABLE ' + BY_SEQ_STORE +
      ' ADD COLUMN deleted TINYINT(1) DEFAULT 0', [], function () {
      tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      tx.executeSql('ALTER TABLE ' + DOC_STORE +
        ' ADD COLUMN local TINYINT(1) DEFAULT 0', [], function () {
        tx.executeSql('CREATE INDEX IF NOT EXISTS \'doc-store-local-idx\' ON ' +
          DOC_STORE + ' (local, id)');

        var sql = 'SELECT ' + DOC_STORE + '.winningseq AS seq, ' + DOC_STORE +
          '.json AS metadata FROM ' + BY_SEQ_STORE + ' JOIN ' + DOC_STORE +
          ' ON ' + BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';

        tx.executeSql(sql, [], function (tx, result) {

          var deleted = [];
          var local = [];

          for (var i = 0; i < result.rows.length; i++) {
            var item = result.rows.item(i);
            var seq = item.seq;
            var metadata = JSON.parse(item.metadata);
            if (utils.isDeleted(metadata)) {
              deleted.push(seq);
            }
            if (utils.isLocalId(metadata.id)) {
              local.push(metadata.id);
            }
          }
          tx.executeSql('UPDATE ' + DOC_STORE + 'SET local = 1 WHERE id IN (' +
            local.map(function () {
            return '?';
          }).join(',') + ')', local, function () {
            tx.executeSql('UPDATE ' + BY_SEQ_STORE +
              ' SET deleted = 1 WHERE seq IN (' + deleted.map(function () {
              return '?';
            }).join(',') + ')', deleted, callback);
          });
        });
      });
    });
  }

  // in this migration, we make all the local docs unversioned
  function runMigration3(tx, callback) {
    var local = 'CREATE TABLE IF NOT EXISTS ' + LOCAL_STORE +
      ' (id UNIQUE, rev, json)';
    tx.executeSql(local, [], function () {
      var sql = 'SELECT ' + DOC_STORE + '.id AS id, ' +
        BY_SEQ_STORE + '.json AS data ' +
        'FROM ' + BY_SEQ_STORE + ' JOIN ' +
        DOC_STORE + ' ON ' + BY_SEQ_STORE + '.seq = ' +
        DOC_STORE + '.winningseq WHERE local = 1';
      tx.executeSql(sql, [], function (tx, res) {
        var rows = [];
        for (var i = 0; i < res.rows.length; i++) {
          rows.push(res.rows.item(i));
        }
        function doNext() {
          if (!rows.length) {
            return callback(tx);
          }
          var row = rows.shift();
          var rev = JSON.parse(row.data)._rev;
          tx.executeSql('INSERT INTO ' + LOCAL_STORE +
              ' (id, rev, json) VALUES (?,?,?)',
              [row.id, rev, row.data], function (tx) {
            tx.executeSql('DELETE FROM ' + DOC_STORE + ' WHERE id=?',
                [row.id], function (tx) {
              tx.executeSql('DELETE FROM ' + BY_SEQ_STORE + ' WHERE seq=?',
                  [row.seq], function () {
                doNext();
              });
            });
          });
        }
        doNext();
      });
    });
  }

  // in this migration, we remove doc_id_rev and just use rev
  function runMigration4(tx, callback) {

    function updateRows(rows) {
      function doNext() {
        if (!rows.length) {
          return callback(tx);
        }
        var row = rows.shift();
        var doc_id_rev = parseHexString(row.hex, encoding);
        var idx = doc_id_rev.lastIndexOf('::');
        var doc_id = doc_id_rev.substring(0, idx);
        var rev = doc_id_rev.substring(idx + 2);
        var sql = 'UPDATE ' + BY_SEQ_STORE +
          ' SET doc_id=?, rev=? WHERE doc_id_rev=?';
        tx.executeSql(sql, [doc_id, rev, doc_id_rev], function () {
          doNext();
        });
      }
      doNext();
    }

    var sql = 'ALTER TABLE ' + BY_SEQ_STORE + ' ADD COLUMN doc_id';
    tx.executeSql(sql, [], function (tx) {
      var sql = 'ALTER TABLE ' + BY_SEQ_STORE + ' ADD COLUMN rev';
      tx.executeSql(sql, [], function (tx) {
        tx.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL, [], function (tx) {
          var sql = 'SELECT hex(doc_id_rev) as hex FROM ' + BY_SEQ_STORE;
          tx.executeSql(sql, [], function (tx, res) {
            var rows = [];
            for (var i = 0; i < res.rows.length; i++) {
              rows.push(res.rows.item(i));
            }
            updateRows(rows);
          });
        });
      });
    });
  }

  // in this migration, we add the attach_and_seq table
  // for issue #2818
  function runMigration5(tx, callback) {

    function migrateAttsAndSeqs(tx) {
      // need to actually populate the table. this is the expensive part,
      // so as an optimization, check first that this database even
      // contains attachments
      var sql = 'SELECT COUNT(*) AS cnt FROM ' + ATTACH_STORE;
      tx.executeSql(sql, [], function (tx, res) {
        var count = res.rows.item(0).cnt;
        if (!count) {
          return callback(tx);
        }

        var offset = 0;
        var pageSize = 10;
        function nextPage() {
          var sql = select(
            SELECT_DOCS + ', ' + DOC_STORE + '.id AS id',
            [DOC_STORE, BY_SEQ_STORE],
            DOC_STORE_AND_BY_SEQ_JOINER,
            null,
            DOC_STORE + '.id '
          );
          sql += ' LIMIT ' + pageSize + ' OFFSET ' + offset;
          offset += pageSize;
          tx.executeSql(sql, [], function (tx, res) {
            if (!res.rows.length) {
              return callback(tx);
            }
            var digestSeqs = {};
            function addDigestSeq(digest, seq) {
              // uniq digest/seq pairs, just in case there are dups
              var seqs = digestSeqs[digest] = (digestSeqs[digest] || []);
              if (seqs.indexOf(seq) === -1) {
                seqs.push(seq);
              }
            }
            for (var i = 0; i < res.rows.length; i++) {
              var row = res.rows.item(i);
              var doc = unstringifyDoc(row.data, row.id, row.rev);
              var atts = Object.keys(doc._attachments || {});
              for (var j = 0; j < atts.length; j++) {
                var att = doc._attachments[atts[j]];
                addDigestSeq(att.digest, row.seq);
              }
            }
            var digestSeqPairs = [];
            Object.keys(digestSeqs).forEach(function (digest) {
              var seqs = digestSeqs[digest];
              seqs.forEach(function (seq) {
                digestSeqPairs.push([digest, seq]);
              });
            });
            if (!digestSeqPairs.length) {
              return nextPage();
            }
            var numDone = 0;
            digestSeqPairs.forEach(function (pair) {
              var sql = 'INSERT INTO ' + ATTACH_AND_SEQ_STORE +
                ' (digest, seq) VALUES (?,?)';
              tx.executeSql(sql, pair, function () {
                if (++numDone === digestSeqPairs.length) {
                  nextPage();
                }
              });
            });
          });
        }
        nextPage();
      });
    }

    var attachAndRev = 'CREATE TABLE IF NOT EXISTS ' +
      ATTACH_AND_SEQ_STORE + ' (digest, seq INTEGER)';
    tx.executeSql(attachAndRev, [], function (tx) {
      tx.executeSql(
        ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL, [], function (tx) {
          tx.executeSql(
            ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL, [],
            migrateAttsAndSeqs);
        });
    });
  }

  // in this migration, we use escapeBlob() and unescapeBlob()
  // instead of reading out the binary as HEX, which is slow
  function runMigration6(tx, callback) {
    var sql = 'ALTER TABLE ' + ATTACH_STORE +
      ' ADD COLUMN escaped TINYINT(1) DEFAULT 0';
    tx.executeSql(sql, [], callback);
  }

  function checkEncoding(tx, cb) {
    // UTF-8 on chrome/android, UTF-16 on safari < 7.1
    tx.executeSql('SELECT HEX("a") AS hex', [], function (tx, res) {
        var hex = res.rows.item(0).hex;
        encoding = hex.length === 2 ? 'UTF-8' : 'UTF-16';
        cb();
      }
    );
  }

  function onGetInstanceId() {
    while (idRequests.length > 0) {
      var idCallback = idRequests.pop();
      idCallback(null, instanceId);
    }
  }

  function onGetVersion(tx, dbVersion) {
    if (dbVersion === 0) {
      // initial schema

      var meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE +
        ' (dbid, db_version INTEGER)';
      var attach = 'CREATE TABLE IF NOT EXISTS ' + ATTACH_STORE +
        ' (digest UNIQUE, escaped TINYINT(1), body BLOB)';
      var attachAndRev = 'CREATE TABLE IF NOT EXISTS ' +
        ATTACH_AND_SEQ_STORE + ' (digest, seq INTEGER)';
      var doc = 'CREATE TABLE IF NOT EXISTS ' + DOC_STORE +
        ' (id unique, json, winningseq)';
      var seq = 'CREATE TABLE IF NOT EXISTS ' + BY_SEQ_STORE +
        ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, ' +
        'json, deleted TINYINT(1), doc_id, rev)';
      var local = 'CREATE TABLE IF NOT EXISTS ' + LOCAL_STORE +
        ' (id UNIQUE, rev, json)';

      // creates
      tx.executeSql(attach);
      tx.executeSql(local);
      tx.executeSql(attachAndRev, [], function () {
        tx.executeSql(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL);
        tx.executeSql(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL);
      });
      tx.executeSql(doc, [], function () {
        tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
        tx.executeSql(seq, [], function () {
          tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
          tx.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL);
          tx.executeSql(meta, [], function () {
            // mark the db version, and new dbid
            var initSeq = 'INSERT INTO ' + META_STORE +
              ' (db_version, dbid) VALUES (?,?)';
            instanceId = utils.uuid();
            var initSeqArgs = [ADAPTER_VERSION, instanceId];
            tx.executeSql(initSeq, initSeqArgs, function (tx) {
              onGetInstanceId();
            });
          });
        });
      });
    } else { // version > 0

      var setupDone = function () {
        var migrated = dbVersion < ADAPTER_VERSION;
        if (migrated) {
          // update the db version within this transaction
          tx.executeSql('UPDATE ' + META_STORE + ' SET db_version = ' +
            ADAPTER_VERSION);
        }
        // notify db.id() callers
        var sql = 'SELECT dbid FROM ' + META_STORE;
        tx.executeSql(sql, [], function (tx, result) {
          instanceId = result.rows.item(0).dbid;
          onGetInstanceId();
        });
      };

      // would love to use promises here, but then websql
      // ends the transaction early
      var tasks = [
        runMigration2,
        runMigration3,
        runMigration4,
        runMigration5,
        runMigration6,
        setupDone
      ];

      // run each migration sequentially
      var i = dbVersion;
      var nextMigration = function (tx) {
        tasks[i - 1](tx, nextMigration);
        i++;
      };
      nextMigration(tx);
    }
  }

  function setup() {
    db.transaction(function (tx) {
      // first check the encoding
      checkEncoding(tx, function () {
        // then get the version
        fetchVersion(tx);
      });
    }, unknownError(callback), dbCreated);
  }

  function fetchVersion(tx) {
    var sql = 'SELECT sql FROM sqlite_master WHERE tbl_name = ' + META_STORE;
    tx.executeSql(sql, [], function (tx, result) {
      if (!result.rows.length) {
        // database hasn't even been created yet (version 0)
        onGetVersion(tx, 0);
      } else if (!/db_version/.test(result.rows.item(0).sql)) {
        // table was created, but without the new db_version column,
        // so add it.
        tx.executeSql('ALTER TABLE ' + META_STORE +
          ' ADD COLUMN db_version INTEGER', [], function () {
          // before version 2, this column didn't even exist
          onGetVersion(tx, 1);
        });
      } else { // column exists, we can safely get it
        tx.executeSql('SELECT db_version FROM ' + META_STORE,
          [], function (tx, result) {
          var dbVersion = result.rows.item(0).db_version;
          onGetVersion(tx, dbVersion);
        });
      }
    });
  }

  if (utils.isCordova() && typeof global !== 'undefined') {
    //to wait until custom api is made in pouch.adapters before doing setup
    global.addEventListener(name + '_pouch', function cordova_init() {
      global.removeEventListener(name + '_pouch', cordova_init, false);
      setup();
    }, false);
  } else {
    setup();
  }

  api.type = function () {
    return 'websql';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._info = function (callback) {
    db.readTransaction(function (tx) {
      countDocs(tx, function (docCount) {
        var sql = 'SELECT MAX(seq) AS seq FROM ' + BY_SEQ_STORE;
        tx.executeSql(sql, [], function (tx, res) {
          var updateSeq = res.rows.item(0).seq || 0;
          callback(null, {
            doc_count: docCount,
            update_seq: updateSeq
          });
        });
      });
    }, unknownError(callback));
  };

  api._bulkDocs = function (req, opts, callback) {

    var newEdits = opts.new_edits;
    var userDocs = req.docs;

    // Parse the docs, give them a sequence number for the result
    var docInfos = userDocs.map(function (doc, i) {
      if (doc._id && utils.isLocalId(doc._id)) {
        return doc;
      }
      var newDoc = utils.parseDoc(doc, newEdits);
      newDoc._bulk_seq = i;
      return newDoc;
    });

    var docInfoErrors = docInfos.filter(function (docInfo) {
      return docInfo.error;
    });
    if (docInfoErrors.length) {
      return callback(docInfoErrors[0]);
    }

    var tx;
    var results = new Array(docInfos.length);
    var fetchedDocs = new utils.Map();
    var numDocsWritten = 0;

    function complete() {
      var aresults = results.map(function (result) {
        if (result._bulk_seq) {
          delete result._bulk_seq;
        } else if (!Object.keys(result).length) {
          return {
            ok: true
          };
        }
        if (result.error) {
          return result;
        }

        var metadata = result.metadata;
        var rev = merge.winningRev(metadata);

        return {
          ok: true,
          id: metadata.id,
          rev: rev
        };
      });
      WebSqlPouch.Changes.notify(name);

      callback(null, aresults);
    }

    function verifyAttachment(digest, callback) {
      var sql = 'SELECT count(*) as cnt FROM ' + ATTACH_STORE +
        ' WHERE digest=?';
      tx.executeSql(sql, [digest], function (tx, result) {
        if (result.rows.item(0).cnt === 0) {
          var err = new Error('unknown stub attachment with digest ' + digest);
          err.status = 412;
          callback(err);
        } else {
          callback();
        }
      });
    }

    function verifyAttachments(finish) {
      var digests = [];
      docInfos.forEach(function (docInfo) {
        if (docInfo.data && docInfo.data._attachments) {
          Object.keys(docInfo.data._attachments).forEach(function (filename) {
            var att = docInfo.data._attachments[filename];
            if (att.stub) {
              digests.push(att.digest);
            }
          });
        }
      });
      if (!digests.length) {
        return finish();
      }
      var numDone = 0;
      var err;

      function checkDone() {
        if (++numDone === digests.length) {
          finish(err);
        }
      }
      digests.forEach(function (digest) {
        verifyAttachment(digest, function (attErr) {
          if (attErr && !err) {
            err = attErr;
          }
          checkDone();
        });
      });
    }

    function preprocessAttachment(att, finish) {
      if (att.stub) {
        return finish();
      }
      if (typeof att.data === 'string') {
        try {
          att.data = atob(att.data);
        } catch (e) {
          var err = errors.error(errors.BAD_ARG,
                                "Attachments need to be base64 encoded");
          return callback(err);
        }
        var data = utils.fixBinary(att.data);
        att.data = utils.createBlob([data], {type: att.content_type});
      }
      utils.readAsBinaryString(att.data, function (binary) {
        att.data = binary;
        utils.MD5(binary).then(function (result) {
          att.digest = 'md5-' + result;
          att.length = binary.length;
          finish();
        });
      });
    }

    function preprocessAttachments(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var docv = 0;

      docInfos.forEach(function (docInfo) {
        var attachments = docInfo.data && docInfo.data._attachments ?
          Object.keys(docInfo.data._attachments) : [];
        var recv = 0;

        if (!attachments.length) {
          return done();
        }

        function processedAttachment() {
          recv++;
          if (recv === attachments.length) {
            done();
          }
        }

        for (var key in docInfo.data._attachments) {
          if (docInfo.data._attachments.hasOwnProperty(key)) {
            preprocessAttachment(docInfo.data._attachments[key],
                                 processedAttachment);
          }
        }
      });

      function done() {
        docv++;
        if (docInfos.length === docv) {
          callback();
        }
      }
    }

    function writeDoc(docInfo, winningRev, deleted, callback, isUpdate,
                      resultsIdx) {

      function finish() {
        var data = docInfo.data;
        var deletedInt = deleted ? 1 : 0;

        var id = data._id;
        var rev = data._rev;
        var json = stringifyDoc(data);
        var sql = 'INSERT INTO ' + BY_SEQ_STORE +
          ' (doc_id, rev, json, deleted) VALUES (?, ?, ?, ?);';
        var sqlArgs = [id, rev, json, deletedInt];

        // map seqs to attachment digests, which
        // we will need later during compaction
        function insertAttachmentMappings(seq, callback) {
          var attsAdded = 0;
          var attsToAdd = Object.keys(data._attachments || {});

          if (!attsToAdd.length) {
            return callback();
          }
          function checkDone() {
            if (++attsAdded === attsToAdd.length) {
              callback();
            }
            return false; // ack handling a constraint error
          }
          function add(att) {
            var sql = 'INSERT INTO ' + ATTACH_AND_SEQ_STORE +
              ' (digest, seq) VALUES (?,?)';
            var sqlArgs = [data._attachments[att].digest, seq];
            tx.executeSql(sql, sqlArgs, checkDone, checkDone);
            // second callback is for a constaint error, which we ignore
            // because this docid/rev has already been associated with
            // the digest (e.g. when new_edits == false)
          }
          for (var i = 0; i < attsToAdd.length; i++) {
            add(attsToAdd[i]); // do in parallel
          }
        }

        tx.executeSql(sql, sqlArgs, function (tx, result) {
          var seq = result.insertId;
          insertAttachmentMappings(seq, function () {
            dataWritten(tx, seq);
          });
        }, function () {
          // constraint error, recover by updating instead (see #1638)
          var fetchSql = select('seq', BY_SEQ_STORE, null,
            'doc_id=? AND rev=?');
          tx.executeSql(fetchSql, [id, rev], function (tx, res) {
            var seq = res.rows.item(0).seq;
            var sql = 'UPDATE ' + BY_SEQ_STORE +
              ' SET json=?, deleted=? WHERE doc_id=? AND rev=?;';
            var sqlArgs = [json, deletedInt, id, rev];
            tx.executeSql(sql, sqlArgs, function (tx) {
              insertAttachmentMappings(seq, function () {
                dataWritten(tx, seq);
              });
            });
          });
          return false; // ack that we've handled the error
        });
      }

      function collectResults(attachmentErr) {
        if (!err) {
          if (attachmentErr) {
            err = attachmentErr;
            callback(err);
          } else if (recv === attachments.length) {
            finish();
          }
        }
      }

      var err = null;
      var recv = 0;

      docInfo.data._id = docInfo.metadata.id;
      docInfo.data._rev = docInfo.metadata.rev;

      if (deleted) {
        docInfo.data._deleted = true;
      }

      var attachments = docInfo.data._attachments ?
        Object.keys(docInfo.data._attachments) : [];

      function attachmentSaved(err) {
        recv++;
        collectResults(err);
      }

      for (var key in docInfo.data._attachments) {
        if (!docInfo.data._attachments[key].stub) {
          var data = docInfo.data._attachments[key].data;
          delete docInfo.data._attachments[key].data;
          var digest = docInfo.data._attachments[key].digest;
          saveAttachment(digest, data, attachmentSaved);
        } else {
          recv++;
          collectResults();
        }
      }

      if (!attachments.length) {
        finish();
      }

      function dataWritten(tx, seq) {
        docInfo.metadata.seq = seq;
        delete docInfo.metadata.rev;

        var sql = isUpdate ?
          'UPDATE ' + DOC_STORE +
          ' SET json=?, winningseq=(SELECT seq FROM ' + BY_SEQ_STORE +
          ' WHERE doc_id=' + DOC_STORE + '.id AND rev=?) WHERE id=?'
          : 'INSERT INTO ' + DOC_STORE +
          ' (id, winningseq, json) VALUES (?, ?, ?);';
        var metadataStr = vuvuzela.stringify(docInfo.metadata);
        var id = docInfo.metadata.id;
        var params = isUpdate ?
          [metadataStr, winningRev, id] :
          [id, seq, metadataStr];
        tx.executeSql(sql, params, function () {
          results[resultsIdx] = docInfo;
          fetchedDocs.set(id, docInfo.metadata);
          callback();
        });
      }
    }

    function updateDoc(oldDoc, docInfo, resultsIdx, callback) {

      if (utils.revExists(oldDoc, docInfo.metadata.rev)) {
        results[resultsIdx] = docInfo;
        callback();
        return;
      }

      var merged =
        merge.merge(oldDoc.rev_tree, docInfo.metadata.rev_tree[0], 1000);

      var previouslyDeleted = utils.isDeleted(oldDoc);
      var deleted = utils.isDeleted(docInfo.metadata);
      var inConflict = (previouslyDeleted && deleted && newEdits) ||
        (!previouslyDeleted && newEdits && merged.conflicts !== 'new_leaf') ||
        (previouslyDeleted && !deleted && merged.conflicts === 'new_branch');

      if (inConflict) {
        results[resultsIdx] = makeErr(errors.REV_CONFLICT, docInfo._bulk_seq);
        return callback();
      }

      docInfo.metadata.rev_tree = merged.tree;

      // recalculate
      var winningRev = merge.winningRev(docInfo.metadata);
      deleted = utils.isDeleted(docInfo.metadata, winningRev);

      writeDoc(docInfo, winningRev, deleted, callback, true, resultsIdx);
    }

    function insertDoc(docInfo, resultsIdx, callback) {
      // Cant insert new deleted documents
      var winningRev = merge.winningRev(docInfo.metadata);
      var deleted = utils.isDeleted(docInfo.metadata, winningRev);
      if ('was_delete' in opts && deleted) {
        results[resultsIdx] = errors.MISSING_DOC;
        return callback();
      }
      writeDoc(docInfo, winningRev, deleted, callback, false, resultsIdx);
    }

    function checkDoneWritingDocs() {
      if (++numDocsWritten === docInfos.length) {
        complete();
      }
    }

    function processDocs() {
      if (!docInfos.length) {
        return complete();
      }

      var idsToDocs = new utils.Map();

      docInfos.forEach(function (currentDoc, resultsIdx) {

        if (currentDoc._id && utils.isLocalId(currentDoc._id)) {
          api[currentDoc._deleted ? '_removeLocal' : '_putLocal'](
              currentDoc, {ctx: tx}, function (err, resp) {
            if (err) {
              results[resultsIdx] = err;
            } else {
              results[resultsIdx] = {};
            }
            checkDoneWritingDocs();
          });
          return;
        }

        var id = currentDoc.metadata.id;
        if (idsToDocs.has(id)) {
          idsToDocs.get(id).push([currentDoc, resultsIdx]);
        } else {
          idsToDocs.set(id, [[currentDoc, resultsIdx]]);
        }
      });

      // in the case of new_edits, the user can provide multiple docs
      // with the same id. these need to be processed sequentially
      idsToDocs.forEach(function (docs, id) {
        var numDone = 0;

        function docWritten() {
          checkDoneWritingDocs();
          if (++numDone < docs.length) {
            nextDoc();
          }
        }
        function nextDoc() {
          var value = docs[numDone];
          var currentDoc = value[0];
          var resultsIdx = value[1];

          if (fetchedDocs.has(id)) {
            updateDoc(fetchedDocs.get(id), currentDoc, resultsIdx, docWritten);
          } else {
            insertDoc(currentDoc, resultsIdx, docWritten);
          }
        }
        nextDoc();
      });
    }

    function fetchExistingDocs(callback) {
      if (!docInfos.length) {
        return callback();
      }

      var numFetched = 0;

      function checkDone() {
        if (++numFetched === docInfos.length) {
          callback();
        }
      }

      docInfos.forEach(function (docInfo) {
        if (docInfo._id && utils.isLocalId(docInfo._id)) {
          return checkDone(); // skip local docs
        }
        var id = docInfo.metadata.id;
        tx.executeSql('SELECT json FROM ' + DOC_STORE +
          ' WHERE id = ?', [id], function (tx, result) {
          if (result.rows.length) {
            var metadata = vuvuzela.parse(result.rows.item(0).json);
            fetchedDocs.set(id, metadata);
          }
          checkDone();
        });
      });
    }

    // Insert sequence number into the error so we can sort later
    function makeErr(err, seq) {
      err._bulk_seq = seq;
      return err;
    }

    function saveAttachment(digest, data, callback) {
      var sql = 'SELECT digest FROM ' + ATTACH_STORE + ' WHERE digest=?';
      tx.executeSql(sql, [digest], function (tx, result) {
        if (result.rows.length) { // attachment already exists
          return callback();
        }
        // we could just insert before selecting and catch the error,
        // but my hunch is that it's cheaper not to serialize the blob
        // from JS to C if we don't have to (TODO: confirm this)
        sql = 'INSERT INTO ' + ATTACH_STORE +
          ' (digest, body, escaped) VALUES (?,?,1)';
        tx.executeSql(sql, [digest, escapeBlob(data)], function () {
          callback();
        }, function () {
          // ignore constaint errors, means it already exists
          callback();
          return false; // ack we handled the error
        });
      });
    }

    preprocessAttachments(function () {
      db.transaction(function (txn) {
        tx = txn;
        verifyAttachments(function (err) {
          if (err) {
            return callback(err);
          }
          fetchExistingDocs(processDocs);
        });
      }, unknownError(callback), function () {
        docCount = -1;
      });
    });
  };

  api._get = function (id, opts, callback) {
    opts = utils.clone(opts);
    var doc;
    var metadata;
    var err;
    if (!opts.ctx) {
      db.readTransaction(function (txn) {
        opts.ctx = txn;
        api._get(id, opts, callback);
      });
      return;
    }
    var tx = opts.ctx;

    function finish() {
      callback(err, {doc: doc, metadata: metadata, ctx: tx});
    }

    var sql;
    var sqlArgs;
    if (opts.rev) {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE + '.id=' + BY_SEQ_STORE + '.doc_id',
        [BY_SEQ_STORE + '.doc_id=?', BY_SEQ_STORE + '.rev=?']);
      sqlArgs = [id, opts.rev];
    } else {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER,
        DOC_STORE + '.id=?');
      sqlArgs = [id];
    }
    tx.executeSql(sql, sqlArgs, function (a, results) {
      if (!results.rows.length) {
        err = errors.MISSING_DOC;
        return finish();
      }
      var item = results.rows.item(0);
      metadata = vuvuzela.parse(item.metadata);
      if (item.deleted && !opts.rev) {
        err = errors.error(errors.MISSING_DOC, 'deleted');
        return finish();
      }
      doc = unstringifyDoc(item.data, metadata.id, item.rev);
      finish();
    });
  };

  function countDocs(tx, callback) {

    if (docCount !== -1) {
      return callback(docCount);
    }

    // count the total rows
    var sql = select(
      'COUNT(' + DOC_STORE + '.id) AS \'num\'',
      [DOC_STORE, BY_SEQ_STORE],
      DOC_STORE_AND_BY_SEQ_JOINER,
      BY_SEQ_STORE + '.deleted=0');

    tx.executeSql(sql, [], function (tx, result) {
      docCount = result.rows.item(0).num;
      callback(docCount);
    });
  }

  api._allDocs = function (opts, callback) {
    var results = [];
    var totalRows;

    var start = 'startkey' in opts ? opts.startkey : false;
    var end = 'endkey' in opts ? opts.endkey : false;
    var key = 'key' in opts ? opts.key : false;
    var descending = 'descending' in opts ? opts.descending : false;
    var limit = 'limit' in opts ? opts.limit : -1;
    var offset = 'skip' in opts ? opts.skip : 0;
    var inclusiveEnd = opts.inclusive_end !== false;

    var sqlArgs = [];
    var criteria = [];

    if (key !== false) {
      criteria.push(DOC_STORE + '.id = ?');
      sqlArgs.push(key);
    } else if (start !== false || end !== false) {
      if (start !== false) {
        criteria.push(DOC_STORE + '.id ' + (descending ? '<=' : '>=') + ' ?');
        sqlArgs.push(start);
      }
      if (end !== false) {
        var comparator = descending ? '>' : '<';
        if (inclusiveEnd) {
          comparator += '=';
        }
        criteria.push(DOC_STORE + '.id ' + comparator + ' ?');
        sqlArgs.push(end);
      }
      if (key !== false) {
        criteria.push(DOC_STORE + '.id = ?');
        sqlArgs.push(key);
      }
    }

    if (opts.deleted !== 'ok') {
      // report deleted if keys are specified
      criteria.push(BY_SEQ_STORE + '.deleted = 0');
    }

    db.readTransaction(function (tx) {

      // first count up the total rows
      countDocs(tx, function (count) {
        totalRows = count;

        if (limit === 0) {
          return;
        }

        // then actually fetch the documents
        var sql = select(
          SELECT_DOCS,
          [DOC_STORE, BY_SEQ_STORE],
          DOC_STORE_AND_BY_SEQ_JOINER,
          criteria,
          DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC')
          );
        sql += ' LIMIT ' + limit + ' OFFSET ' + offset;

        tx.executeSql(sql, sqlArgs, function (tx, result) {
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var item = result.rows.item(i);
            var metadata = vuvuzela.parse(item.metadata);
            var data = unstringifyDoc(item.data, metadata.id, item.rev);
            var winningRev = data._rev;
            var doc = {
              id: metadata.id,
              key: metadata.id,
              value: {rev: winningRev}
            };
            if (opts.include_docs) {
              doc.doc = data;
              doc.doc._rev = winningRev;
              if (opts.conflicts) {
                doc.doc._conflicts = merge.collectConflicts(metadata);
              }
              for (var att in doc.doc._attachments) {
                if (doc.doc._attachments.hasOwnProperty(att)) {
                  doc.doc._attachments[att].stub = true;
                }
              }
            }
            if (item.deleted) {
              if (opts.deleted === 'ok') {
                doc.value.deleted = true;
                doc.doc = null;
              } else {
                continue;
              }
            }
            results.push(doc);
          }
        });
      });
    }, unknownError(callback), function () {
      callback(null, {
        total_rows: totalRows,
        offset: opts.skip,
        rows: results
      });
    });
  };

  api._changes = function (opts) {
    opts = utils.clone(opts);

    if (opts.continuous) {
      var id = name + ':' + utils.uuid();
      WebSqlPouch.Changes.addListener(name, id, api, opts);
      WebSqlPouch.Changes.notify(name);
      return {
        cancel: function () {
          WebSqlPouch.Changes.removeListener(name, id);
        }
      };
    }

    var descending = opts.descending;

    // Ignore the `since` parameter when `descending` is true
    opts.since = opts.since && !descending ? opts.since : 0;

    var limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1; // per CouchDB _changes spec
    }

    var returnDocs;
    if ('returnDocs' in opts) {
      returnDocs = opts.returnDocs;
    } else {
      returnDocs = true;
    }
    var results = [];
    var numResults = 0;
    function fetchChanges() {

      var criteria = [
        DOC_STORE + '.winningseq > ' + opts.since
      ];
      var sqlArgs = [];
      if (opts.doc_ids) {
        criteria.push(DOC_STORE + '.id IN (' + opts.doc_ids.map(function () {
          return '?';
        }).join(',') + ')');
        sqlArgs = opts.doc_ids;
      }

      var sql = select(SELECT_DOCS, [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER, criteria,
        DOC_STORE + '.winningseq ' + (descending ? 'DESC' : 'ASC'));

      var filter = utils.filterChange(opts);
      if (!opts.view && !opts.filter) {
        // we can just limit in the query
        sql += ' LIMIT ' + limit;
      }

      db.readTransaction(function (tx) {
        tx.executeSql(sql, sqlArgs, function (tx, result) {
          var lastSeq = 0;
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var res = result.rows.item(i);
            var metadata = vuvuzela.parse(res.metadata);
            if (lastSeq < res.seq) {
              lastSeq = res.seq;
            }
            var doc = unstringifyDoc(res.data, metadata.id, res.rev);
            var change = opts.processChange(doc, metadata, opts);
            change.seq = res.seq;
            if (filter(change)) {
              numResults++;
              if (returnDocs) {
                results.push(change);
              }
              opts.onChange(change);
            }
            if (numResults === limit) {
              break;
            }
          }
          if (!opts.continuous) {
            opts.complete(null, {
              results: results,
              last_seq: lastSeq
            });
          }
        });
      });
    }

    fetchChanges();
  };

  api._close = function (callback) {
    //WebSQL databases do not need to be closed
    callback();
  };

  api._getAttachment = function (attachment, opts, callback) {
    var res;
    var tx = opts.ctx;
    var digest = attachment.digest;
    var type = attachment.content_type;
    var sql = 'SELECT escaped, ' +
      'CASE WHEN escaped = 1 THEN body ELSE HEX(body) END AS body FROM ' +
      ATTACH_STORE + ' WHERE digest=?';
    tx.executeSql(sql, [digest], function (tx, result) {
      // websql has a bug where \u0000 causes early truncation in strings
      // and blobs. to work around this, we used to use the hex() function,
      // but that's not performant. after migration 6, we remove \u0000
      // and add it back in afterwards
      var item = result.rows.item(0);
      var data = item.escaped ? unescapeBlob(item.body) :
        parseHexString(item.body, encoding);
      if (opts.encode) {
        res = btoa(data);
      } else {
        data = utils.fixBinary(data);
        res = utils.createBlob([data], {type: type});
      }
      callback(null, res);
    });
  };

  api._getRevisionTree = function (docId, callback) {
    db.readTransaction(function (tx) {
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        if (!result.rows.length) {
          callback(errors.MISSING_DOC);
        } else {
          var data = vuvuzela.parse(result.rows.item(0).metadata);
          callback(null, data.rev_tree);
        }
      });
    });
  };

  api._doCompaction = function (docId, revs, callback) {
    if (!revs.length) {
      return callback();
    }
    db.transaction(function (tx) {

      // update doc store
      var sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      tx.executeSql(sql, [docId], function (tx, result) {
        var metadata = vuvuzela.parse(result.rows.item(0).metadata);
        merge.traverseRevTree(metadata.rev_tree, function (isLeaf, pos,
                                                           revHash, ctx, opts) {
          var rev = pos + '-' + revHash;
          if (revs.indexOf(rev) !== -1) {
            opts.status = 'missing';
          }
        });

        var sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';
        tx.executeSql(sql, [vuvuzela.stringify(metadata), docId]);
      });

      // update by-seq and attach stores in parallel
      revs.forEach(function (rev) {
        var sql = 'SELECT seq FROM ' + BY_SEQ_STORE +
          ' WHERE doc_id=? AND rev=?';
        tx.executeSql(sql, [docId, rev], function (tx, res) {
          if (!res.rows.length) {
            return; // already deleted
          }
          var seq = res.rows.item(0).seq;

          // find orphaned attachment digests
          var sql = 'SELECT a1.digest AS digest ' +
              'FROM ' + ATTACH_AND_SEQ_STORE + ' a1 JOIN ' +
              ATTACH_AND_SEQ_STORE + ' a2 ON a1.digest=a2.digest ' +
              'WHERE a1.seq=? ' +
              'GROUP BY a1.digest HAVING COUNT(*) = 1';
          tx.executeSql(sql, [seq], function (tx, res) {
            var orphanedAttachments = [];
            for (var i = 0; i < res.rows.length; i++) {
              orphanedAttachments.push(res.rows.item(i).digest);
            }

            tx.executeSql(
              'DELETE FROM ' + BY_SEQ_STORE + ' WHERE seq=?', [seq]);
            tx.executeSql(
              'DELETE FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE seq=?', [seq]);
            orphanedAttachments.forEach(function (digest) {
              tx.executeSql(
                'DELETE FROM ' + ATTACH_AND_SEQ_STORE + ' WHERE digest=?',
                [digest]);
              tx.executeSql(
                'DELETE FROM ' + ATTACH_STORE + ' WHERE digest=?', [digest]);
            });
          });
        });
      });
    }, unknownError(callback), function () {
      callback();
    });
  };

  api._getLocal = function (id, callback) {
    db.readTransaction(function (tx) {
      var sql = 'SELECT json, rev FROM ' + LOCAL_STORE + ' WHERE id=?';
      tx.executeSql(sql, [id], function (tx, res) {
        if (res.rows.length) {
          var item = res.rows.item(0);
          var doc = unstringifyDoc(item.json, id, item.rev);
          callback(null, doc);
        } else {
          callback(errors.MISSING_DOC);
        }
      });
    });
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    var newRev;
    if (!oldRev) {
      newRev = doc._rev = '0-1';
    } else {
      newRev = doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }
    var json = stringifyDoc(doc);

    var ret;
    function putLocal(tx) {
      var sql;
      var values;
      if (oldRev) {
        sql = 'UPDATE ' + LOCAL_STORE + ' SET rev=?, json=? ' +
          'WHERE id=? AND rev=?';
        values = [newRev, json, id, oldRev];
      } else {
        sql = 'INSERT INTO ' + LOCAL_STORE + ' (id, rev, json) VALUES (?,?,?)';
        values = [id, newRev, json];
      }
      tx.executeSql(sql, values, function (tx, res) {
        if (res.rowsAffected) {
          ret = {ok: true, id: id, rev: newRev};
          if (opts.ctx) { // return immediately
            callback(null, ret);
          }
        } else {
          callback(errors.REV_CONFLICT);
        }
      }, function () {
        callback(errors.REV_CONFLICT);
        return false; // ack that we handled the error
      });
    }

    if (opts.ctx) {
      putLocal(opts.ctx);
    } else {
      db.transaction(function (tx) {
        putLocal(tx);
      }, unknownError(callback), function () {
        if (ret) {
          callback(null, ret);
        }
      });
    }
  };

  api._removeLocal = function (doc, callback) {
    var ret;
    db.transaction(function (tx) {
      var sql = 'DELETE FROM ' + LOCAL_STORE + ' WHERE id=? AND rev=?';
      var params = [doc._id, doc._rev];
      tx.executeSql(sql, params, function (tx, res) {
        if (!res.rowsAffected) {
          return callback(errors.REV_CONFLICT);
        }
        ret = {ok: true, id: doc._id, rev: '0-0'};
      });
    }, unknownError(callback), function () {
      callback(null, ret);
    });
  };
}

WebSqlPouch.valid = function () {
  if (typeof global !== 'undefined') {
    if (global.navigator &&
        global.navigator.sqlitePlugin &&
        global.navigator.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.sqlitePlugin && global.sqlitePlugin.openDatabase) {
      return true;
    } else if (global.openDatabase) {
      return true;
    }
  }
  return false;
};

WebSqlPouch.destroy = utils.toPromise(function (name, opts, callback) {
  WebSqlPouch.Changes.removeAllListeners(name);
  var size = getSize(opts);
  var db = openDB(name, POUCH_VERSION, name, size);
  db.transaction(function (tx) {
    var stores = [DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, META_STORE,
      LOCAL_STORE, ATTACH_AND_SEQ_STORE];
    stores.forEach(function (store) {
      tx.executeSql('DROP TABLE IF EXISTS ' + store, []);
    });
  }, unknownError(callback), function () {
    if (utils.hasLocalStorage()) {
      delete global.localStorage['_pouch__websqldb_' + name];
      delete global.localStorage[name];
    }
    callback(null, {'ok': true});
  });
});

WebSqlPouch.Changes = new utils.Changes();

module.exports = WebSqlPouch;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../deps/errors":12,"../deps/parse-hex":14,"../merge":21,"../utils":26,"vuvuzela":61}],6:[function(_dereq_,module,exports){
'use strict';
var utils = _dereq_('./utils');
var merge = _dereq_('./merge');
var errors = _dereq_('./deps/errors');
var EE = _dereq_('events').EventEmitter;
var evalFilter = _dereq_('./evalFilter');
var evalView = _dereq_('./evalView');
module.exports = Changes;
utils.inherits(Changes, EE);

function Changes(db, opts, callback) {
  EE.call(this);
  var self = this;
  this.db = db;
  opts = opts ? utils.clone(opts) : {};
  var oldComplete = callback || opts.complete || function () {};
  var complete = opts.complete = utils.once(function (err, resp) {
    if (err) {
      self.emit('error', err);
    } else {
      self.emit('complete', resp);
    }
    self.removeAllListeners();
    db.removeListener('destroyed', onDestroy);
  });
  if (oldComplete) {
    self.on('complete', function (resp) {
      oldComplete(null, resp);
    });
    self.on('error', function (err) {
      oldComplete(err);
    });
  }
  var oldOnChange = opts.onChange;
  if (oldOnChange) {
    self.on('change', oldOnChange);
  }
  function onDestroy() {
    self.cancel();
  }
  db.once('destroyed', onDestroy);

  opts.onChange = function (change) {
    if (opts.isCancelled) {
      return;
    }
    self.emit('change', change);
    if (self.startSeq && self.startSeq <= change.seq) {
      self.emit('uptodate');
      self.startSeq = false;
    }
    if (change.deleted) {
      self.emit('delete', change);
    } else if (change.changes.length === 1 &&
      change.changes[0].rev.slice(0, 2) === '1-') {
      self.emit('create', change);
    } else {
      self.emit('update', change);
    }
  };

  var promise = new utils.Promise(function (fulfill, reject) {
    opts.complete = function (err, res) {
      if (err) {
        reject(err);
      } else {
        fulfill(res);
      }
    };
  });
  self.once('cancel', function () {
    if (oldOnChange) {
      self.removeListener('change', oldOnChange);
    }
    opts.complete(null, {status: 'cancelled'});
  });
  this.then = promise.then.bind(promise);
  this['catch'] = promise['catch'].bind(promise);
  this.then(function (result) {
    complete(null, result);
  }, complete);



  if (!db.taskqueue.isReady) {
    db.taskqueue.addTask(function () {
      if (self.isCancelled) {
        self.emit('cancel');
      } else {
        self.doChanges(opts);
      }
    });
  } else {
    self.doChanges(opts);
  }
}
Changes.prototype.cancel = function () {
  this.isCancelled = true;
  if (this.db.taskqueue.isReady) {
    this.emit('cancel');
  }
};
function processChange(doc, metadata, opts) {
  var changeList = [{rev: doc._rev}];
  if (opts.style === 'all_docs') {
    changeList = merge.collectLeaves(metadata.rev_tree)
    .map(function (x) { return {rev: x.rev}; });
  }
  var change = {
    id: metadata.id,
    changes: changeList,
    doc: doc
  };

  if (utils.isDeleted(metadata, doc._rev)) {
    change.deleted = true;
  }
  if (opts.conflicts) {
    change.doc._conflicts = merge.collectConflicts(metadata);
    if (!change.doc._conflicts.length) {
      delete change.doc._conflicts;
    }
  }
  return change;
}

Changes.prototype.doChanges = function (opts) {
  var self = this;
  var callback = opts.complete;

  opts = utils.clone(opts);
  if ('live' in opts && !('continuous' in opts)) {
    opts.continuous = opts.live;
  }
  opts.processChange = processChange;

  if (opts.since === 'latest') {
    opts.since = 'now';
  }
  if (!opts.since) {
    opts.since = 0;
  }
  if (opts.since === 'now') {
    this.db.info().then(function (info) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      opts.since = info.update_seq  - 1;
      self.doChanges(opts);
    }, callback);
    return;
  }

  if (opts.continuous && opts.since !== 'now') {
    this.db.info().then(function (info) {
      self.startSeq = info.update_seq - 1;
    }, function (err) {
      if (err.id === 'idbNull') {
        //db closed before this returned
        //thats ok
        return;
      }
      throw err;
    });
  }

  if (this.db.type() !== 'http' &&
    opts.filter && typeof opts.filter === 'string') {
    return this.filterChanges(opts);
  }

  if (!('descending' in opts)) {
    opts.descending = false;
  }

  // 0 and 1 should return 1 document
  opts.limit = opts.limit === 0 ? 1 : opts.limit;
  opts.complete = callback;
  var newPromise = this.db._changes(opts);
  if (newPromise && typeof newPromise.cancel === 'function') {
    var cancel = self.cancel;
    self.cancel = utils.getArguments(function (args) {
      newPromise.cancel();
      cancel.apply(this, args);
    });
  }
};

Changes.prototype.filterChanges = function (opts) {
  var self = this;
  var callback = opts.complete;
  if (opts.filter === '_view') {
    if (!opts.view || typeof opts.view !== 'string') {
      var err = new  Error('`view` filter parameter is not provided.');
      err.status = errors.BAD_REQUEST.status;
      err.name = errors.BAD_REQUEST.name;
      err.error = true;
      callback(err);
      return;
    }
    // fetch a view from a design doc, make it behave like a filter
    var viewName = opts.view.split('/');
    this.db.get('_design/' + viewName[0], function (err, ddoc) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      if (err) {
        callback(err);
        return;
      }
      if (ddoc && ddoc.views && ddoc.views[viewName[1]]) {
        
        var filter = evalView(ddoc.views[viewName[1]].map);
        opts.filter = filter;
        self.doChanges(opts);
        return;
      }
      var msg = ddoc.views ? 'missing json key: ' + viewName[1] :
        'missing json key: views';
      if (!err) {
        err = new  Error(msg);
        err.status = errors.MISSING_DOC.status;
        err.name = errors.MISSING_DOC.name;
        err.error = true;
      }
      callback(err);
      return;
    });
  } else {
    // fetch a filter from a design doc
    var filterName = opts.filter.split('/');
    this.db.get('_design/' + filterName[0], function (err, ddoc) {
      if (self.isCancelled) {
        callback(null, {status: 'cancelled'});
        return;
      }
      if (err) {
        callback(err);
        return;
      }
      if (ddoc && ddoc.filters && ddoc.filters[filterName[1]]) {
        var filter = evalFilter(ddoc.filters[filterName[1]]);
        opts.filter = filter;
        self.doChanges(opts);
        return;
      } else {
        var msg = (ddoc && ddoc.filters) ? 'missing json key: ' + filterName[1]
          : 'missing json key: filters';
        if (!err) {
          err = new  Error(msg);
          err.status = errors.MISSING_DOC.status;
          err.name = errors.MISSING_DOC.name;
          err.error = true;
        }
        callback(err);
        return;
      }
    });
  }
};
},{"./deps/errors":12,"./evalFilter":18,"./evalView":19,"./merge":21,"./utils":26,"events":30}],7:[function(_dereq_,module,exports){
'use strict';

var utils = _dereq_('./utils');

function updateCheckpoint(db, id, checkpoint, returnValue) {
  return db.get(id)["catch"](function (err) {
    if (err.status === 404) {
      if (db.type() === 'http') {
        utils.explain404(
          'PouchDB is just checking if a remote checkpoint exists.');
      }
      return {_id: id};
    }
    throw err;
  }).then(function (doc) {
    if (returnValue.cancelled) {
      return;
    }
    doc.last_seq = checkpoint;
    return db.put(doc);
  });
}

function Checkpointer(src, target, id, returnValue) {
  this.src = src;
  this.target = target;
  this.id = id;
  this.returnValue = returnValue;
}

Checkpointer.prototype.writeCheckpoint = function (checkpoint) {
  var self = this;
  return this.updateTarget(checkpoint).then(function () {
    return self.updateSource(checkpoint);
  });
};

Checkpointer.prototype.updateTarget = function (checkpoint) {
  return updateCheckpoint(this.target, this.id, checkpoint, this.returnValue);
};

Checkpointer.prototype.updateSource = function (checkpoint) {
  var self = this;
  if (this.readOnlySource) {
    return utils.Promise.resolve(true);
  }
  return updateCheckpoint(this.src, this.id, checkpoint, this.returnValue)[
    "catch"](function (err) {
      var isForbidden = typeof err.status === 'number' &&
        Math.floor(err.status / 100) === 4;
      if (isForbidden) {
        self.readOnlySource = true;
        return true;
      }
      throw err;
    });
};

Checkpointer.prototype.getCheckpoint = function () {
  var self = this;
  return self.target.get(self.id).then(function (targetDoc) {
    return self.src.get(self.id).then(function (sourceDoc) {
      if (targetDoc.last_seq === sourceDoc.last_seq) {
        return sourceDoc.last_seq;
      }
      return 0;
    }, function (err) {
      if (err.status === 404 && targetDoc.last_seq) {
        return self.src.put({
          _id: self.id,
          last_seq: 0
        }).then(function () {
          return 0;
        }, function (err) {
          if (err.status === 401) {
            self.readOnlySource = true;
            return targetDoc.last_seq;
          }
          return 0;
        });
      }
      throw err;
    });
  })["catch"](function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return 0;
  });
};

module.exports = Checkpointer;

},{"./utils":26}],8:[function(_dereq_,module,exports){
(function (global){
/*globals cordova */
"use strict";

var Adapter = _dereq_('./adapter');
var utils = _dereq_('./utils');
var TaskQueue = _dereq_('./taskqueue');
var Promise = utils.Promise;

function defaultCallback(err) {
  if (err && global.debug) {
    console.error(err);
  }
}

utils.inherits(PouchDB, Adapter);
function PouchDB(name, opts, callback) {

  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts, callback);
  }
  var self = this;
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (name && typeof name === 'object') {
    opts = name;
    name = undefined;
  }
  if (typeof callback === 'undefined') {
    callback = defaultCallback;
  }
  opts = opts || {};
  this.__opts = opts;
  var oldCB = callback;
  self.auto_compaction = opts.auto_compaction;
  self.prefix = PouchDB.prefix;
  Adapter.call(self);
  self.taskqueue = new TaskQueue();
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  
    opts = utils.clone(opts);
    var originalName = opts.name || name;
    var backend, error;
    (function () {
      try {

        if (typeof originalName !== 'string') {
          error = new Error('Missing/invalid DB name');
          error.code = 400;
          throw error;
        }

        backend = PouchDB.parseAdapter(originalName, opts);
        
        opts.originalName = originalName;
        opts.name = backend.name;
        if (opts.prefix && backend.adapter !== 'http' &&
            backend.adapter !== 'https') {
          opts.name = opts.prefix + opts.name;
        }
        opts.adapter = opts.adapter || backend.adapter;
        self._adapter = opts.adapter;
        self._db_name = originalName;
        if (!PouchDB.adapters[opts.adapter]) {
          error = new Error('Adapter is missing');
          error.code = 404;
          throw error;
        }

        if (!PouchDB.adapters[opts.adapter].valid()) {
          error = new Error('Invalid Adapter');
          error.code = 404;
          throw error;
        }
      } catch (err) {
        self.taskqueue.fail(err);
        self.changes = utils.toPromise(function (opts) {
          if (opts.complete) {
            opts.complete(err);
          }
        });
      }
    }());
    if (error) {
      return reject(error); // constructor error, see above
    }
    self.adapter = opts.adapter;

    // needs access to PouchDB;
    self.replicate = {};

    self.replicate.from = function (url, opts, callback) {
      return self.constructor.replicate(url, self, opts, callback);
    };

    self.replicate.to = function (url, opts, callback) {
      return self.constructor.replicate(self, url, opts, callback);
    };

    self.sync = function (dbName, opts, callback) {
      return self.constructor.sync(self, dbName, opts, callback);
    };

    self.replicate.sync = self.sync;

    self.destroy = utils.adapterFun('destroy', function (callback) {
      var self = this;
      self.info(function (err, info) {
        if (err) {
          return callback(err);
        }
        self.constructor.destroy(info.db_name, callback);
      });
    });

    PouchDB.adapters[opts.adapter].call(self, opts, function (err, db) {
      if (err) {
        if (callback) {
          self.taskqueue.fail(err);
          callback(err);
        }
        return;
      }
      function destructionListener(event) {
        if (event === 'destroyed') {
          self.emit('destroyed');
          PouchDB.removeListener(originalName, destructionListener);
        }
      }
      PouchDB.on(originalName, destructionListener);
      self.emit('created', self);
      PouchDB.emit('created', opts.originalName);
      self.taskqueue.ready(self);
      callback(null, self);
      
    });
    if (opts.skipSetup) {
      self.taskqueue.ready(self);
    }

    if (utils.isCordova()) {
      //to inform websql adapter that we can use api
      cordova.fireWindowEvent(opts.name + "_pouch", {});
    }
  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  self.then = promise.then.bind(promise);
  self["catch"] = promise["catch"].bind(promise);

}

module.exports = PouchDB;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./adapter":1,"./taskqueue":25,"./utils":26}],9:[function(_dereq_,module,exports){
"use strict";

var createBlob = _dereq_('./blob.js');
var errors = _dereq_('./errors');
var utils = _dereq_("../utils");
var hasUpload;

function ajax(options, adapterCallback) {

  var requestCompleted = false;
  var callback = utils.getArguments(function (args) {
    if (requestCompleted) {
      return;
    }
    adapterCallback.apply(this, args);
    requestCompleted = true;
  });

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  options = utils.clone(options);

  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 10000,
    cache: false
  };

  options = utils.extend(true, defaultOptions, options);

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  if (options.method === 'GET' && !options.cache) {
    var hasArgs = options.url.indexOf('?') !== -1;
    options.url += (hasArgs ? '&' : '?') + '_nonce=' + utils.uuid(16);
  }

  function onSuccess(obj, resp, cb) {
    if (!options.binary && !options.json && options.processData &&
      typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    } else if (!options.binary && options.json && typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (e) {
        // Probably a malformed JSON from server
        return cb(e);
      }
    }
    if (Array.isArray(obj)) {
      obj = obj.map(function (v) {
        var obj;
        if (v.ok) {
          return v;
        } else if (v.error && v.error === 'conflict') {
          obj = errors.REV_CONFLICT;
          obj.id = v.id;
          return obj;
        } else if (v.error && v.error === 'forbidden') {
          obj = errors.FORBIDDEN;
          obj.id = v.id;
          obj.reason = v.reason;
          return obj;
        } else if (v.missing) {
          obj = errors.MISSING_DOC;
          obj.missing = v.missing;
          return obj;
        } else {
          return v;
        }
      });
    }
    cb(null, obj, resp);
  }

  function onError(err, cb) {
    var errParsed, errObj, errType, key;
    try {
      errParsed = JSON.parse(err.responseText);
      //would prefer not to have a try/catch clause
      for (key in errors) {
        if (errors.hasOwnProperty(key) &&
            errors[key].name === errParsed.error) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType, errParsed.reason);
    } catch (e) {
      for (var key in errors) {
        if (errors.hasOwnProperty(key) && errors[key].status === err.status) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType);
    }
    if (err.withCredentials && err.status === 0) {
      // apparently this is what we get when the method
      // is reported as not allowed by CORS. so fudge it
      errObj.status = 405;
      errObj.statusText = "Method Not Allowed";
    }
    cb(errObj);
  }

  var timer;
  var xhr;
  if (options.xhr) {
    xhr = new options.xhr();
  } else {
    xhr = new XMLHttpRequest();
  }
  xhr.open(options.method, options.url);
  xhr.withCredentials = true;

  if (options.json) {
    options.headers.Accept = 'application/json';
    options.headers['Content-Type'] = options.headers['Content-Type'] ||
      'application/json';
    if (options.body &&
        options.processData &&
        typeof options.body !== "string") {
      options.body = JSON.stringify(options.body);
    }
  }

  if (options.binary) {
    xhr.responseType = 'arraybuffer';
  }

  var createCookie = function (name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
  };

  for (var key in options.headers) {
    if (key === 'Cookie') {
      var cookie = options.headers[key].split('=');
      createCookie(cookie[0], cookie[1], 10);
    } else {
      xhr.setRequestHeader(key, options.headers[key]);
    }
  }

  if (!("body" in options)) {
    options.body = null;
  }

  var abortReq = function () {
    if (requestCompleted) {
      return;
    }
    xhr.abort();
    onError(xhr, callback);
  };

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4 || requestCompleted) {
      return;
    }
    clearTimeout(timer);
    if (xhr.status >= 200 && xhr.status < 300) {
      var data;
      if (options.binary) {
        data = createBlob([xhr.response || ''], {
          type: xhr.getResponseHeader('Content-Type')
        });
      } else {
        data = xhr.responseText;
      }
      onSuccess(data, xhr, callback);
    } else {
      onError(xhr, callback);
    }
  };

  if (options.timeout > 0) {
    timer = setTimeout(abortReq, options.timeout);
    xhr.onprogress = function () {
      clearTimeout(timer);
      timer = setTimeout(abortReq, options.timeout);
    };
    if (typeof hasUpload === 'undefined') {
      // IE throws an error if you try to access it directly
      hasUpload = Object.keys(xhr).indexOf('upload') !== -1;
    }
    if (hasUpload) { // does not exist in ie9
      xhr.upload.onprogress = xhr.onprogress;
    }
  }
  if (options.body && (options.body instanceof Blob)) {
    utils.readAsBinaryString(options.body, function (binary) {
      xhr.send(utils.fixBinary(binary));
    });
  } else {
    xhr.send(options.body);
  }
  return {abort: abortReq};
}

module.exports = ajax;

},{"../utils":26,"./blob.js":10,"./errors":12}],10:[function(_dereq_,module,exports){
(function (global){
"use strict";

//Abstracts constructing a Blob object, so it also works in older
//browsers that don't support the native Blob constructor. (i.e.
//old QtWebKit versions, at least).
function createBlob(parts, properties) {
  parts = parts || [];
  properties = properties || {};
  try {
    return new Blob(parts, properties);
  } catch (e) {
    if (e.name !== "TypeError") {
      throw e;
    }
    var BlobBuilder = global.BlobBuilder ||
                      global.MSBlobBuilder ||
                      global.MozBlobBuilder ||
                      global.WebKitBlobBuilder;
    var builder = new BlobBuilder();
    for (var i = 0; i < parts.length; i += 1) {
      builder.append(parts[i]);
    }
    return builder.getBlob(properties.type);
  }
}

module.exports = createBlob;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],11:[function(_dereq_,module,exports){
'use strict';
exports.Map = LazyMap; // TODO: use ES6 map
exports.Set = LazySet; // TODO: use ES6 set
// based on https://github.com/montagejs/collections
function LazyMap() {
  this.store = {};
}
LazyMap.prototype.mangle = function (key) {
  if (typeof key !== "string") {
    throw new TypeError("key must be a string but Got " + key);
  }
  return '$' + key;
};
LazyMap.prototype.unmangle = function (key) {
  return key.substring(1);
};
LazyMap.prototype.get = function (key) {
  var mangled = this.mangle(key);
  if (mangled in this.store) {
    return this.store[mangled];
  } else {
    return void 0;
  }
};
LazyMap.prototype.set = function (key, value) {
  var mangled = this.mangle(key);
  this.store[mangled] = value;
  return true;
};
LazyMap.prototype.has = function (key) {
  var mangled = this.mangle(key);
  return mangled in this.store;
};
LazyMap.prototype["delete"] = function (key) {
  var mangled = this.mangle(key);
  if (mangled in this.store) {
    delete this.store[mangled];
    return true;
  }
  return false;
};
LazyMap.prototype.forEach = function (cb) {
  var self = this;
  var keys = Object.keys(self.store);
  keys.forEach(function (key) {
    var value = self.store[key];
    key = self.unmangle(key);
    cb(value, key);
  });
};

function LazySet() {
  this.store = new LazyMap();
}
LazySet.prototype.add = function (key) {
  return this.store.set(key, true);
};
LazySet.prototype.has = function (key) {
  return this.store.has(key);
};
LazySet.prototype["delete"] = function (key) {
  return this.store["delete"](key);
};
},{}],12:[function(_dereq_,module,exports){
"use strict";

function PouchError(opts) {
  this.status = opts.status;
  this.name = opts.error;
  this.message = opts.reason;
  this.error = true;
}

PouchError.prototype__proto__ = Error.prototype;

PouchError.prototype.toString = function () {
  return JSON.stringify({
    status: this.status,
    name: this.name,
    message: this.message
  });
};

exports.UNAUTHORIZED = new PouchError({
  status: 401,
  error: 'unauthorized',
  reason: "Name or password is incorrect."
});
exports.MISSING_BULK_DOCS = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: "Missing JSON list of 'docs'"
});
exports.MISSING_DOC = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'missing'
});
exports.REV_CONFLICT = new PouchError({
  status: 409,
  error: 'conflict',
  reason: 'Document update conflict'
});
exports.INVALID_ID = new PouchError({
  status: 400,
  error: 'invalid_id',
  reason: '_id field must contain a string'
});
exports.MISSING_ID = new PouchError({
  status: 412,
  error: 'missing_id',
  reason: '_id is required for puts'
});
exports.RESERVED_ID = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Only reserved document ids may start with underscore.'
});
exports.NOT_OPEN = new PouchError({
  status: 412,
  error: 'precondition_failed',
  reason: 'Database not open'
});
exports.UNKNOWN_ERROR = new PouchError({
  status: 500,
  error: 'unknown_error',
  reason: 'Database encountered an unknown error'
});
exports.BAD_ARG = new PouchError({
  status: 500,
  error: 'badarg',
  reason: 'Some query argument is invalid'
});
exports.INVALID_REQUEST = new PouchError({
  status: 400,
  error: 'invalid_request',
  reason: 'Request was invalid'
});
exports.QUERY_PARSE_ERROR = new PouchError({
  status: 400,
  error: 'query_parse_error',
  reason: 'Some query parameter is invalid'
});
exports.DOC_VALIDATION = new PouchError({
  status: 500,
  error: 'doc_validation',
  reason: 'Bad special document member'
});
exports.BAD_REQUEST = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Something wrong with the request'
});
exports.NOT_AN_OBJECT = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Document must be a JSON object'
});
exports.DB_MISSING = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'Database not found'
});
exports.IDB_ERROR = new PouchError({
  status: 500,
  error: 'indexed_db_went_bad',
  reason: 'unknown'
});
exports.WSQ_ERROR = new PouchError({
  status: 500,
  error: 'web_sql_went_bad',
  reason: 'unknown'
});
exports.LDB_ERROR = new PouchError({
  status: 500,
  error: 'levelDB_went_went_bad',
  reason: 'unknown'
});
exports.FORBIDDEN = new PouchError({
  status: 403,
  error: 'forbidden',
  reason: 'Forbidden by design doc validate_doc_update function'
});
exports.error = function (error, reason, name) {
  function CustomPouchError(msg) {
    this.message = reason;
    if (name) {
      this.name = name;
    }
  }
  CustomPouchError.prototype = error;
  return new CustomPouchError(reason);
};

},{}],13:[function(_dereq_,module,exports){
(function (process,global){
'use strict';

var crypto = _dereq_('crypto');
var Md5 = _dereq_('spark-md5');
var setImmediateShim = global.setImmediate || global.setTimeout;
var MD5_CHUNK_SIZE = 32768;

function sliceShim(arrayBuffer, begin, end) {
  if (typeof arrayBuffer.slice === 'function') {
    if (!begin) {
      return arrayBuffer.slice();
    } else if (!end) {
      return arrayBuffer.slice(begin);
    } else {
      return arrayBuffer.slice(begin, end);
    }
  }
  //
  // shim for IE courtesy of http://stackoverflow.com/a/21440217
  //

  //If `begin`/`end` is unspecified, Chrome assumes 0, so we do the same
  //Chrome also converts the values to integers via flooring
  begin = Math.floor(begin || 0);
  end = Math.floor(end || 0);

  var len = arrayBuffer.byteLength;

  //If either `begin` or `end` is negative, it refers to an
  //index from the end of the array, as opposed to from the beginning.
  //The range specified by the `begin` and `end` values is clamped to the
  //valid index range for the current array.
  begin = begin < 0 ? Math.max(begin + len, 0) : Math.min(len, begin);
  end = end < 0 ? Math.max(end + len, 0) : Math.min(len, end);

  //If the computed length of the new ArrayBuffer would be negative, it
  //is clamped to zero.
  if (end - begin <= 0) {
    return new ArrayBuffer(0);
  }

  var result = new ArrayBuffer(end - begin);
  var resultBytes = new Uint8Array(result);
  var sourceBytes = new Uint8Array(arrayBuffer, begin, end - begin);

  resultBytes.set(sourceBytes);

  return result;
}

// convert a 64-bit int to a binary string
function intToString(int) {
  var bytes = [
    (int & 0xff),
    ((int >>> 8) & 0xff),
    ((int >>> 16) & 0xff),
    ((int >>> 24) & 0xff)
  ];
  return bytes.map(function (byte) {
    return String.fromCharCode(byte);
  }).join('');
}

// convert an array of 64-bit ints into
// a base64-encoded string
function rawToBase64(raw) {
  var res = '';
  for (var i = 0; i < raw.length; i++) {
    res += intToString(raw[i]);
  }
  return global.btoa(res);
}

module.exports = function (data, callback) {
  if (!process.browser) {
    var base64 = crypto.createHash('md5').update(data).digest('base64');
    callback(null, base64);
    return;
  }
  var inputIsString = typeof data === 'string';
  var len = inputIsString ? data.length : data.byteLength;
  var chunkSize = Math.min(MD5_CHUNK_SIZE, len);
  var chunks = Math.ceil(len / chunkSize);
  var currentChunk = 0;
  var buffer = inputIsString ? new Md5() : new Md5.ArrayBuffer();

  function append(buffer, data, start, end) {
    if (inputIsString) {
      buffer.appendBinary(data.substring(start, end));
    } else {
      buffer.append(sliceShim(data, start, end));
    }
  }

  function loadNextChunk() {
    var start = currentChunk * chunkSize;
    var end = start + chunkSize;
    if ((start + chunkSize) >= data.size) {
      end = data.size;
    }
    currentChunk++;
    if (currentChunk < chunks) {
      append(buffer, data, start, end);
      setImmediateShim(loadNextChunk);
    } else {
      append(buffer, data, start, end);
      var raw = buffer.end(true);
      var base64 = rawToBase64(raw);
      callback(null, base64);
      buffer.destroy();
    }
  }
  loadNextChunk();
};

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"crypto":29,"spark-md5":60}],14:[function(_dereq_,module,exports){
'use strict';

//
// Parsing hex strings. Yeah.
//
// So basically we need this because of a bug in WebSQL:
// https://code.google.com/p/chromium/issues/detail?id=422690
// https://bugs.webkit.org/show_bug.cgi?id=137637
//
// UTF-8 and UTF-16 are provided as separate functions
// for meager performance improvements
//

function decodeUtf8(str) {
  return decodeURIComponent(window.escape(str));
}

function hexToInt(charCode) {
  // '0'-'9' is 48-57
  // 'A'-'F' is 65-70
  // SQLite will only give us uppercase hex
  return charCode < 65 ? (charCode - 48) : (charCode - 55);
}


// Example:
// pragma encoding=utf8;
// select hex('A');
// returns '41'
function parseHexUtf8(str, start, end) {
  var result = '';
  while (start < end) {
    result += String.fromCharCode(
      (hexToInt(str.charCodeAt(start++)) << 4) |
        hexToInt(str.charCodeAt(start++)));
  }
  return result;
}

// Example:
// pragma encoding=utf16;
// select hex('A');
// returns '4100'
// notice that the 00 comes after the 41 (i.e. it's swizzled)
function parseHexUtf16(str, start, end) {
  var result = '';
  while (start < end) {
    // UTF-16, so swizzle the bytes
    result += String.fromCharCode(
      (hexToInt(str.charCodeAt(start + 2)) << 12) |
        (hexToInt(str.charCodeAt(start + 3)) << 8) |
        (hexToInt(str.charCodeAt(start)) << 4) |
        hexToInt(str.charCodeAt(start + 1)));
    start += 4;
  }
  return result;
}

function parseHexString(str, encoding) {
  if (encoding === 'UTF-8') {
    return decodeUtf8(parseHexUtf8(str, 0, str.length));
  } else {
    return parseHexUtf16(str, 0, str.length);
  }
}

module.exports = parseHexString;
},{}],15:[function(_dereq_,module,exports){
'use strict';

// originally parseUri 1.2.2, now patched by us
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
var options = {
  strictMode: false,
  key: ["source", "protocol", "authority", "userInfo", "user", "password",
    "host", "port", "relative", "path", "directory", "file", "query",
    "anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    /* jshint maxlen: false */
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};
function parseUri(str) {
  var o = options;
  var m = o.parser[o.strictMode ? "strict" : "loose"].exec(str);
  var uri = {};
  var i = 14;

  while (i--) {
    var key = o.key[i];
    var value = m[i] || "";
    var encoded = ['user', 'password'].indexOf(key) !== -1;
    uri[key] = encoded ? decodeURIComponent(value) : value;
  }

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) {
      uri[o.q.name][$1] = $2;
    }
  });

  return uri;
}


module.exports = parseUri;
},{}],16:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('../utils').Promise;

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
// the diffFun tells us what delta to apply to the doc.  it either returns
// the doc, or false if it doesn't need to do an update after all
function upsert(db, docId, diffFun) {
  return new Promise(function (fulfill, reject) {
    if (docId && typeof docId === 'object') {
      docId = docId._id;
    }
    if (typeof docId !== 'string') {
      return reject(new Error('doc id is required'));
    }

    db.get(docId, function (err, doc) {
      if (err) {
        if (err.status !== 404) {
          return reject(err);
        }
        return fulfill(tryAndPut(db, diffFun({_id : docId}), diffFun));
      }
      var newDoc = diffFun(doc);
      if (!newDoc) {
        return fulfill(doc);
      }
      fulfill(tryAndPut(db, newDoc, diffFun));
    });
  });
}

function tryAndPut(db, doc, diffFun) {
  return db.put(doc)["catch"](function (err) {
    if (err.status !== 409) {
      throw err;
    }
    return upsert(db, doc, diffFun);
  });
}

module.exports = function (db, docId, diffFun, cb) {
  if (typeof cb === 'function') {
    upsert(db, docId, diffFun).then(function (resp) {
      cb(null, resp);
    }, cb);
  } else {
    return upsert(db, docId, diffFun);
  }
};

},{"../utils":26}],17:[function(_dereq_,module,exports){
"use strict";

// BEGIN Math.uuid.js

/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. 
 *   // (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
var chars = (
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz'
).split('');
function getValue(radix) {
  return 0 | Math.random() * radix;
}
function uuid(len, radix) {
  radix = radix || chars.length;
  var out = '';
  var i = -1;

  if (len) {
    // Compact form
    while (++i < len) {
      out += chars[getValue(radix)];
    }
    return out;
  }
    // rfc4122, version 4 form
    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
  while (++i < 36) {
    switch (i) {
      case 8:
      case 13:
      case 18:
      case 23:
        out += '-';
        break;
      case 19:
        out += chars[(getValue(16) & 0x3) | 0x8];
        break;
      default:
        out += chars[getValue(16)];
    }
  }

  return out;
}



module.exports = uuid;


},{}],18:[function(_dereq_,module,exports){
'use strict';

module.exports = evalFilter;
function evalFilter(input) {
  /*jshint evil: true */
  return eval([
    '(function () { return ',
    input,
    ' })()'
  ].join(''));
}
},{}],19:[function(_dereq_,module,exports){
'use strict';

module.exports = evalView;
function evalView(input) {
  /*jshint evil: true */
  return eval([
    '(function () {',
    '  return function (doc) {',
    '    var emitted = false;',
    '    var emit = function (a, b) {',
    '      emitted = true;',
    '    };',
    '    var view = ' + input + ';',
    '    view(doc);',
    '    if (emitted) {',
    '      return true;',
    '    }',
    '  }',
    '})()'
  ].join('\n'));
}
},{}],20:[function(_dereq_,module,exports){
(function (process){
"use strict";

var PouchDB = _dereq_('./setup');

module.exports = PouchDB;

PouchDB.ajax = _dereq_('./deps/ajax');
PouchDB.extend = _dereq_('pouchdb-extend');
PouchDB.utils = _dereq_('./utils');
PouchDB.Errors = _dereq_('./deps/errors');
PouchDB.replicate = _dereq_('./replicate').replicate;
PouchDB.sync = _dereq_('./sync');
PouchDB.version = _dereq_('./version');
var httpAdapter = _dereq_('./adapters/http');
PouchDB.adapter('http', httpAdapter);
PouchDB.adapter('https', httpAdapter);

PouchDB.adapter('idb', _dereq_('./adapters/idb'));
PouchDB.adapter('websql', _dereq_('./adapters/websql'));
PouchDB.plugin(_dereq_('pouchdb-mapreduce'));

if (!process.browser) {
  var ldbAdapter = _dereq_('./adapters/leveldb');
  PouchDB.adapter('ldb', ldbAdapter);
  PouchDB.adapter('leveldb', ldbAdapter);
}

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./adapters/http":2,"./adapters/idb":3,"./adapters/leveldb":29,"./adapters/websql":5,"./deps/ajax":9,"./deps/errors":12,"./replicate":22,"./setup":23,"./sync":24,"./utils":26,"./version":27,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"pouchdb-extend":51,"pouchdb-mapreduce":54}],21:[function(_dereq_,module,exports){
'use strict';
var extend = _dereq_('pouchdb-extend');


// for a better overview of what this is doing, read:
// https://github.com/apache/couchdb/blob/master/src/couchdb/couch_key_tree.erl
//
// But for a quick intro, CouchDB uses a revision tree to store a documents
// history, A -> B -> C, when a document has conflicts, that is a branch in the
// tree, A -> (B1 | B2 -> C), We store these as a nested array in the format
//
// KeyTree = [Path ... ]
// Path = {pos: position_from_root, ids: Tree}
// Tree = [Key, Opts, [Tree, ...]], in particular single node: [Key, []]

// Turn a path as a flat array into a tree with a single branch
function pathToTree(path) {
  var doc = path.shift();
  var root = [doc.id, doc.opts, []];
  var leaf = root;
  var nleaf;

  while (path.length) {
    doc = path.shift();
    nleaf = [doc.id, doc.opts, []];
    leaf[2].push(nleaf);
    leaf = nleaf;
  }
  return root;
}

// Merge two trees together
// The roots of tree1 and tree2 must be the same revision
function mergeTree(in_tree1, in_tree2) {
  var queue = [{tree1: in_tree1, tree2: in_tree2}];
  var conflicts = false;
  while (queue.length > 0) {
    var item = queue.pop();
    var tree1 = item.tree1;
    var tree2 = item.tree2;

    if (tree1[1].status || tree2[1].status) {
      tree1[1].status =
        (tree1[1].status ===  'available' ||
         tree2[1].status === 'available') ? 'available' : 'missing';
    }

    for (var i = 0; i < tree2[2].length; i++) {
      if (!tree1[2][0]) {
        conflicts = 'new_leaf';
        tree1[2][0] = tree2[2][i];
        continue;
      }

      var merged = false;
      for (var j = 0; j < tree1[2].length; j++) {
        if (tree1[2][j][0] === tree2[2][i][0]) {
          queue.push({tree1: tree1[2][j], tree2: tree2[2][i]});
          merged = true;
        }
      }
      if (!merged) {
        conflicts = 'new_branch';
        tree1[2].push(tree2[2][i]);
        tree1[2].sort();
      }
    }
  }
  return {conflicts: conflicts, tree: in_tree1};
}

function doMerge(tree, path, dontExpand) {
  var restree = [];
  var conflicts = false;
  var merged = false;
  var res;

  if (!tree.length) {
    return {tree: [path], conflicts: 'new_leaf'};
  }

  tree.forEach(function (branch) {
    if (branch.pos === path.pos && branch.ids[0] === path.ids[0]) {
      // Paths start at the same position and have the same root, so they need
      // merged
      res = mergeTree(branch.ids, path.ids);
      restree.push({pos: branch.pos, ids: res.tree});
      conflicts = conflicts || res.conflicts;
      merged = true;
    } else if (dontExpand !== true) {
      // The paths start at a different position, take the earliest path and
      // traverse up until it as at the same point from root as the path we
      // want to merge.  If the keys match we return the longer path with the
      // other merged After stemming we dont want to expand the trees

      var t1 = branch.pos < path.pos ? branch : path;
      var t2 = branch.pos < path.pos ? path : branch;
      var diff = t2.pos - t1.pos;

      var candidateParents = [];

      var trees = [];
      trees.push({ids: t1.ids, diff: diff, parent: null, parentIdx: null});
      while (trees.length > 0) {
        var item = trees.pop();
        if (item.diff === 0) {
          if (item.ids[0] === t2.ids[0]) {
            candidateParents.push(item);
          }
          continue;
        }
        if (!item.ids) {
          continue;
        }
        /*jshint loopfunc:true */
        item.ids[2].forEach(function (el, idx) {
          trees.push(
            {ids: el, diff: item.diff - 1, parent: item.ids, parentIdx: idx});
        });
      }

      var el = candidateParents[0];

      if (!el) {
        restree.push(branch);
      } else {
        res = mergeTree(el.ids, t2.ids);
        el.parent[2][el.parentIdx] = res.tree;
        restree.push({pos: t1.pos, ids: t1.ids});
        conflicts = conflicts || res.conflicts;
        merged = true;
      }
    } else {
      restree.push(branch);
    }
  });

  // We didnt find
  if (!merged) {
    restree.push(path);
  }

  restree.sort(function (a, b) {
    return a.pos - b.pos;
  });

  return {
    tree: restree,
    conflicts: conflicts || 'internal_node'
  };
}

// To ensure we dont grow the revision tree infinitely, we stem old revisions
function stem(tree, depth) {
  // First we break out the tree into a complete list of root to leaf paths,
  // we cut off the start of the path and generate a new set of flat trees
  var stemmedPaths = PouchMerge.rootToLeaf(tree).map(function (path) {
    var stemmed = path.ids.slice(-depth);
    return {
      pos: path.pos + (path.ids.length - stemmed.length),
      ids: pathToTree(stemmed)
    };
  });
  // Then we remerge all those flat trees together, ensuring that we dont
  // connect trees that would go beyond the depth limit
  return stemmedPaths.reduce(function (prev, current, i, arr) {
    return doMerge(prev, current, true).tree;
  }, [stemmedPaths.shift()]);
}

var PouchMerge = {};

PouchMerge.merge = function (tree, path, depth) {
  // Ugh, nicer way to not modify arguments in place?
  tree = extend(true, [], tree);
  path = extend(true, {}, path);
  var newTree = doMerge(tree, path);
  return {
    tree: stem(newTree.tree, depth),
    conflicts: newTree.conflicts
  };
};

// We fetch all leafs of the revision tree, and sort them based on tree length
// and whether they were deleted, undeleted documents with the longest revision
// tree (most edits) win
// The final sort algorithm is slightly documented in a sidebar here:
// http://guide.couchdb.org/draft/conflicts.html
PouchMerge.winningRev = function (metadata) {
  var leafs = [];
  PouchMerge.traverseRevTree(metadata.rev_tree,
                              function (isLeaf, pos, id, something, opts) {
    if (isLeaf) {
      leafs.push({pos: pos, id: id, deleted: !!opts.deleted});
    }
  });
  leafs.sort(function (a, b) {
    if (a.deleted !== b.deleted) {
      return a.deleted > b.deleted ? 1 : -1;
    }
    if (a.pos !== b.pos) {
      return b.pos - a.pos;
    }
    return a.id < b.id ? 1 : -1;
  });

  return leafs[0].pos + '-' + leafs[0].id;
};

// Pretty much all below can be combined into a higher order function to
// traverse revisions
// The return value from the callback will be passed as context to all
// children of that node
PouchMerge.traverseRevTree = function (revs, callback) {
  var toVisit = revs.slice();

  var node;
  while ((node = toVisit.pop())) {
    var pos = node.pos;
    var tree = node.ids;
    var branches = tree[2];
    var newCtx =
      callback(branches.length === 0, pos, tree[0], node.ctx, tree[1]);
    for (var i = 0, len = branches.length; i < len; i++) {
      toVisit.push({pos: pos + 1, ids: branches[i], ctx: newCtx});
    }
  }
};

PouchMerge.collectLeaves = function (revs) {
  var leaves = [];
  PouchMerge.traverseRevTree(revs, function (isLeaf, pos, id, acc, opts) {
    if (isLeaf) {
      leaves.unshift({rev: pos + "-" + id, pos: pos, opts: opts});
    }
  });
  leaves.sort(function (a, b) {
    return b.pos - a.pos;
  });
  leaves.map(function (leaf) { delete leaf.pos; });
  return leaves;
};

// returns revs of all conflicts that is leaves such that
// 1. are not deleted and
// 2. are different than winning revision
PouchMerge.collectConflicts = function (metadata) {
  var win = PouchMerge.winningRev(metadata);
  var leaves = PouchMerge.collectLeaves(metadata.rev_tree);
  var conflicts = [];
  leaves.forEach(function (leaf) {
    if (leaf.rev !== win && !leaf.opts.deleted) {
      conflicts.push(leaf.rev);
    }
  });
  return conflicts;
};

PouchMerge.rootToLeaf = function (tree) {
  var paths = [];
  PouchMerge.traverseRevTree(tree, function (isLeaf, pos, id, history, opts) {
    history = history ? history.slice(0) : [];
    history.push({id: id, opts: opts});
    if (isLeaf) {
      var rootPos = pos + 1 - history.length;
      paths.unshift({pos: rootPos, ids: history});
    }
    return history;
  });
  return paths;
};


module.exports = PouchMerge;

},{"pouchdb-extend":51}],22:[function(_dereq_,module,exports){
'use strict';

var utils = _dereq_('./utils');
var EE = _dereq_('events').EventEmitter;
var Checkpointer = _dereq_('./checkpointer');
var MAX_SIMULTANEOUS_REVS = 50;

function randomNumber(min, max) {
  min = parseInt(min, 10);
  max = parseInt(max, 10);
  if (min !== min) {
    min = 0;
  }
  if (max !== max || max <= min) {
    max = (min || 1) << 1; //doubling
  } else {
    max = max + 1;
  }
  var ratio = Math.random();
  var range = max - min;

  return ~~(range * ratio + min); // ~~ coerces to an int, but fast.
}

function defaultBackOff(min) {
  var max = 0;
  if (!min) {
    max = 2000;
  }
  return randomNumber(min, max);
}

function backOff(repId, src, target, opts, returnValue, result, error) {
  if (opts.retry === false) {
    returnValue.emit('error', error);
    returnValue.removeAllListeners();
    return;
  }
  opts.default_back_off = opts.default_back_off || 0;
  opts.retries = opts.retries || 0;
  if (typeof opts.back_off_function !== 'function') {
    opts.back_off_function = defaultBackOff;
  }
  opts.retries++;
  if (opts.max_retries && opts.retries > opts.max_retries) {
    returnValue.emit('error', new Error('tried ' +
      opts.retries + ' times but replication failed'));
    returnValue.removeAllListeners();
    return;
  }
  returnValue.emit('requestError', error);
  if (returnValue.state === 'active') {
    returnValue.emit('syncStopped');
    returnValue.state = 'stopped';
    returnValue.once('syncRestarted', function () {
      opts.current_back_off = opts.default_back_off;
    });
  }

  opts.current_back_off = opts.current_back_off || opts.default_back_off;
  opts.current_back_off = opts.back_off_function(opts.current_back_off);
  setTimeout(function () {
    replicate(repId, src, target, opts, returnValue);
  }, opts.current_back_off);
}

// We create a basic promise so the caller can cancel the replication possibly
// before we have actually started listening to changes etc
utils.inherits(Replication, EE);
function Replication(opts) {
  EE.call(this);
  this.cancelled = false;
  this.state = 'pending';
  var self = this;
  var promise = new utils.Promise(function (fulfill, reject) {
    self.once('complete', fulfill);
    self.once('error', reject);
  });
  self.then = function (resolve, reject) {
    return promise.then(resolve, reject);
  };
  self["catch"] = function (reject) {
    return promise["catch"](reject);
  };
  // As we allow error handling via "error" event as well,
  // put a stub in here so that rejecting never throws UnhandledError.
  self["catch"](function (err) {});

}

Replication.prototype.cancel = function () {
  this.cancelled = true;
  this.state = 'cancelled';
  this.emit('cancel');
};

Replication.prototype.ready = function (src, target) {
  var self = this;
  this.once('change', function () {
    if (this.state === 'pending') {
      self.state = 'active';
      self.emit('syncStarted');
    } else if (self.state === 'stopped') {
      self.state = 'active';
      self.emit('syncRestarted');
    }
  });
  function onDestroy() {
    self.cancel();
  }
  src.once('destroyed', onDestroy);
  target.once('destroyed', onDestroy);
  function cleanup() {
    src.removeListener('destroyed', onDestroy);
    target.removeListener('destroyed', onDestroy);
  }
  this.then(cleanup, cleanup);
};


// TODO: check CouchDB's replication id generation
// Generate a unique id particular to this replication
function genReplicationId(src, target, opts) {
  var filterFun = opts.filter ? opts.filter.toString() : '';
  return src.id().then(function (src_id) {
    return target.id().then(function (target_id) {
      var queryData = src_id + target_id + filterFun +
        JSON.stringify(opts.query_params) + opts.doc_ids;
      return utils.MD5(queryData).then(function (md5) {
        // can't use straight-up md5 alphabet, because
        // the char '/' is interpreted as being for attachments,
        // and + is also not url-safe
        md5 = md5.replace(/\//g, '.').replace(/\+/g, '_');
        return '_local/' + md5;
      });
    });
  });
}

function replicate(repId, src, target, opts, returnValue, result) {
  var batches = [];               // list of batches to be processed
  var currentBatch;               // the batch currently being processed
  var pendingBatch = {
    seq: 0,
    changes: [],
    docs: []
  }; // next batch, not yet ready to be processed
  var writingCheckpoint = false;  // true while checkpoint is being written
  var changesCompleted = false;   // true when all changes received
  var replicationCompleted = false; // true when replication has completed
  var last_seq = 0;
  var continuous = opts.continuous || opts.live || false;
  var batch_size = opts.batch_size || 100;
  var batches_limit = opts.batches_limit || 10;
  var changesPending = false;     // true while src.changes is running
  var doc_ids = opts.doc_ids;
  var state = {
    cancelled: false
  };
  var checkpointer = new Checkpointer(src, target, repId, state);
  result = result || {
    ok: true,
    start_time: new Date(),
    docs_read: 0,
    docs_written: 0,
    doc_write_failures: 0,
    errors: []
  };
  var changesOpts = {};
  returnValue.ready(src, target);

  function writeDocs() {
    if (currentBatch.docs.length === 0) {
      return;
    }
    var docs = currentBatch.docs;
    return target.bulkDocs({
      docs: docs
    }, {
      new_edits: false
    }).then(function (res) {
      if (state.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      var errors = [];
      res.forEach(function (res) {
        if (res.error) {
          result.doc_write_failures++;
          var error = new Error(res.reason || res.message || 'Unknown reason');
          error.name = res.name || res.error;
          errors.push(error);
        }
      });
      result.errors = result.errors.concat(errors);
      result.docs_written += currentBatch.docs.length - errors.length;
      var non403s = errors.filter(function (error) {
        return error.name !== 'unauthorized' && error.name !== 'forbidden';
      });
      if (non403s.length > 0) {
        var error = new Error('bulkDocs error');
        error.other_errors = errors;
        abortReplication('target.bulkDocs failed to write docs', error);
        throw new Error('bulkWrite partial failure');
      }
    }, function (err) {
      result.doc_write_failures += docs.length;
      throw err;
    });
  }


  function getNextDoc() {
    var diffs = currentBatch.diffs;
    var id = Object.keys(diffs)[0];
    var allMissing = diffs[id].missing;
    // avoid url too long error by batching
    var missingBatches = [];
    for (var i = 0; i < allMissing.length; i += MAX_SIMULTANEOUS_REVS) {
      missingBatches.push(allMissing.slice(i, Math.min(allMissing.length,
        i + MAX_SIMULTANEOUS_REVS)));
    }

    return utils.Promise.all(missingBatches.map(function (missing) {
      return src.get(id, {revs: true, open_revs: missing, attachments: true})
        .then(function (docs) {
          docs.forEach(function (doc) {
            if (state.cancelled) {
              return completeReplication();
            }
            if (doc.ok) {
              result.docs_read++;
              currentBatch.pendingRevs++;
              currentBatch.docs.push(doc.ok);
            }
          });
          delete diffs[id];
        });
    }));
  }

  function getAllDocs() {
    if (Object.keys(currentBatch.diffs).length > 0) {
      return getNextDoc().then(getAllDocs);
    } else {
      return utils.Promise.resolve();
    }
  }


  function getRevisionOneDocs() {
    // filter out the generation 1 docs and get them
    // leaving the non-generation one docs to be got otherwise
    var ids = Object.keys(currentBatch.diffs).filter(function (id) {
      var missing = currentBatch.diffs[id].missing;
      return missing.length === 1 && missing[0].slice(0, 2) === '1-';
    });
    return src.allDocs({
      keys: ids,
      include_docs: true
    }).then(function (res) {
      if (state.cancelled) {
        completeReplication();
        throw (new Error('cancelled'));
      }
      res.rows.forEach(function (row) {
        if (row.doc && !row.deleted &&
          row.value.rev.slice(0, 2) === '1-' && (
            !row.doc._attachments ||
            Object.keys(row.doc._attachments).length === 0
          )
        ) {
          result.docs_read++;
          currentBatch.pendingRevs++;
          currentBatch.docs.push(row.doc);
          delete currentBatch.diffs[row.id];
        }
      });
    });
  }


  function getDocs() {
    return getRevisionOneDocs().then(getAllDocs);
  }


  function finishBatch() {
    writingCheckpoint = true;
    return checkpointer.writeCheckpoint(
      currentBatch.seq
    ).then(function (res) {
      writingCheckpoint = false;
      if (state.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      result.last_seq = last_seq = currentBatch.seq;
      returnValue.emit('change', utils.clone(result));
      currentBatch = undefined;
      getChanges();
    })["catch"](function (err) {
      writingCheckpoint = false;
      abortReplication('writeCheckpoint completed with error', err);
      throw err;
    });
  }


  function getDiffs() {
    var diff = {};
    currentBatch.changes.forEach(function (change) {
      diff[change.id] = change.changes.map(function (x) {
        return x.rev;
      });
    });
    return target.revsDiff(diff).then(function (diffs) {
      if (state.cancelled) {
        completeReplication();
        throw new Error('cancelled');
      }
      // currentBatch.diffs elements are deleted as the documents are written
      currentBatch.diffs = diffs;
      currentBatch.pendingRevs = 0;
    });
  }


  function startNextBatch() {
    if (state.cancelled || currentBatch) {
      return;
    }
    if (batches.length === 0) {
      processPendingBatch(true);
      return;
    }
    currentBatch = batches.shift();
    getDiffs()
    .then(getDocs)
    .then(writeDocs)
    .then(finishBatch)
    .then(startNextBatch)[
    "catch"](function (err) {
      abortReplication('batch processing terminated with error', err);
    });
  }


  function processPendingBatch(immediate) {
    if (pendingBatch.changes.length === 0) {
      if (batches.length === 0 && !currentBatch) {
        if ((continuous && changesOpts.live) || changesCompleted) {
          returnValue.emit('uptodate', utils.clone(result));
        }
        if (changesCompleted) {
          completeReplication();
        }
      }
      return;
    }
    if (
      immediate ||
      changesCompleted ||
      pendingBatch.changes.length >= batch_size
    ) {
      batches.push(pendingBatch);
      pendingBatch = {
        seq: 0,
        changes: [],
        docs: []
      };
      startNextBatch();
    }
  }


  function abortReplication(reason, err) {
    if (replicationCompleted) {
      return;
    }
    result.ok = false;
    result.status = 'aborting';
    result.errors.push(err);
    batches = [];
    pendingBatch = {
      seq: 0,
      changes: [],
      docs: []
    };
    completeReplication();
  }


  function completeReplication() {
    if (replicationCompleted) {
      return;
    }
    if (state.cancelled) {
      result.status = 'cancelled';
      if (writingCheckpoint) {
        return;
      }
    }
    result.status = result.status || 'complete';
    result.end_time = new Date();
    result.last_seq = last_seq;
    replicationCompleted = state.cancelled = true;
    var non403s = result.errors.filter(function (error) {
      return error.name !== 'unauthorized' && error.name !== 'forbidden';
    });
    if (non403s.length > 0) {
      var error = result.errors.pop();
      if (result.errors.length > 0) {
        error.other_errors = result.errors;
      }
      error.result = result;
      backOff(repId, src, target, opts, returnValue, result, error);
    } else {
      returnValue.emit('complete', result);
      returnValue.removeAllListeners();
    }
  }


  function onChange(change) {
    if (state.cancelled) {
      return completeReplication();
    }
    if (
      pendingBatch.changes.length === 0 &&
      batches.length === 0 &&
      !currentBatch
    ) {
      returnValue.emit('outofdate', utils.clone(result));
    }
    pendingBatch.seq = change.seq;
    pendingBatch.changes.push(change);
    processPendingBatch(batches.length === 0);
  }


  function onChangesComplete(changes) {
    changesPending = false;
    if (state.cancelled) {
      return completeReplication();
    }
    if (changesOpts.since < changes.last_seq) {
      changesOpts.since = changes.last_seq;
      getChanges();
    } else {
      if (continuous) {
        changesOpts.live = true;
        getChanges();
      } else {
        changesCompleted = true;
      }
    }
    processPendingBatch(true);
  }


  function onChangesError(err) {
    changesPending = false;
    if (state.cancelled) {
      return completeReplication();
    }
    abortReplication('changes rejected', err);
  }


  function getChanges() {
    if (!(
      !changesPending &&
      !changesCompleted &&
      batches.length < batches_limit
    )) {
      return;
    }
    changesPending = true;
    function abortChanges() {
      changes.cancel();
    }
    function removeListener() {
      returnValue.removeListener('cancel', abortChanges);
    }
    returnValue.once('cancel', abortChanges);
    var changes = src.changes(changesOpts)
    .on('change', onChange);
    changes.then(removeListener, removeListener);
    changes.then(onChangesComplete)[
    "catch"](onChangesError);
  }


  function startChanges() {
    checkpointer.getCheckpoint().then(function (checkpoint) {
      last_seq = checkpoint;
      changesOpts = {
        since: last_seq,
        limit: batch_size,
        batch_size: batch_size,
        style: 'all_docs',
        doc_ids: doc_ids,
        returnDocs: false
      };
      if (opts.filter) {
        changesOpts.filter = opts.filter;
      }
      if (opts.query_params) {
        changesOpts.query_params = opts.query_params;
      }
      getChanges();
    })["catch"](function (err) {
      abortReplication('getCheckpoint rejected with ', err);
    });
  }


  returnValue.once('cancel', completeReplication);

  if (typeof opts.onChange === 'function') {
    returnValue.on('change', opts.onChange);
  }

  if (typeof opts.complete === 'function') {
    returnValue.once('error', opts.complete);
    returnValue.once('complete', function (result) {
      opts.complete(null, result);
    });
  }

  if (typeof opts.since === 'undefined') {
    startChanges();
  } else {
    writingCheckpoint = true;
    checkpointer.writeCheckpoint(opts.since).then(function (res) {
      writingCheckpoint = false;
      if (state.cancelled) {
        completeReplication();
        return;
      }
      last_seq = opts.since;
      startChanges();
    })["catch"](function (err) {
      writingCheckpoint = false;
      abortReplication('writeCheckpoint completed with error', err);
      throw err;
    });
  }
}

exports.toPouch = toPouch;
function toPouch(db, opts) {
  var PouchConstructor = opts.PouchConstructor;
  if (typeof db === 'string') {
    return new PouchConstructor(db);
  } else if (db.then) {
    return db;
  } else {
    return utils.Promise.resolve(db);
  }
}


exports.replicate = replicateWrapper;
function replicateWrapper(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  if (!opts.complete) {
    opts.complete = callback || function () {};
  }
  opts = utils.clone(opts);
  opts.continuous = opts.continuous || opts.live;
  opts.retry = opts.retry || false;
  /*jshint validthis:true */
  opts.PouchConstructor = opts.PouchConstructor || this;
  var replicateRet = new Replication(opts);
  toPouch(src, opts).then(function (src) {
    return toPouch(target, opts).then(function (target) {
      return genReplicationId(src, target, opts).then(function (repId) {
        replicate(repId, src, target, opts, replicateRet);
      });
    });
  })["catch"](function (err) {
    replicateRet.emit('error', err);
    opts.complete(err);
  });
  return replicateRet;
}

},{"./checkpointer":7,"./utils":26,"events":30}],23:[function(_dereq_,module,exports){
(function (global){
"use strict";

var PouchDB = _dereq_("./constructor");
var utils = _dereq_('./utils');
var Promise = utils.Promise;
var EventEmitter = _dereq_('events').EventEmitter;
PouchDB.adapters = {};
PouchDB.preferredAdapters = _dereq_('./adapters/preferredAdapters.js');

PouchDB.prefix = '_pouch_';

var eventEmitter = new EventEmitter();

var eventEmitterMethods = [
  'on',
  'addListener',
  'emit',
  'listeners',
  'once',
  'removeAllListeners',
  'removeListener',
  'setMaxListeners'
];

eventEmitterMethods.forEach(function (method) {
  PouchDB[method] = eventEmitter[method].bind(eventEmitter);
});
PouchDB.setMaxListeners(0);
PouchDB.parseAdapter = function (name, opts) {
  var match = name.match(/([a-z\-]*):\/\/(.*)/);
  var adapter, adapterName;
  if (match) {
    // the http adapter expects the fully qualified name
    name = /http(s?)/.test(match[1]) ? match[1] + '://' + match[2] : match[2];
    adapter = match[1];
    if (!PouchDB.adapters[adapter].valid()) {
      throw 'Invalid adapter';
    }
    return {name: name, adapter: match[1]};
  }

  // check for browsers that have been upgraded from websql-only to websql+idb
  var skipIdb = 'idb' in PouchDB.adapters && 'websql' in PouchDB.adapters &&
    utils.hasLocalStorage() &&
    global.localStorage['_pouch__websqldb_' + PouchDB.prefix + name];

  if (typeof opts !== 'undefined' && opts.db) {
    adapterName = 'leveldb';
  } else {
    for (var i = 0; i < PouchDB.preferredAdapters.length; ++i) {
      adapterName = PouchDB.preferredAdapters[i];
      if (adapterName in PouchDB.adapters) {
        if (skipIdb && adapterName === 'idb') {
          continue; // keep using websql to avoid user data loss
        }
        break;
      }
    }
  }

  adapter = PouchDB.adapters[adapterName];
  if (adapterName && adapter) {
    var use_prefix = 'use_prefix' in adapter ? adapter.use_prefix : true;

    return {
      name: use_prefix ? PouchDB.prefix + name : name,
      adapter: adapterName
    };
  }

  throw 'No valid adapter found';
};

PouchDB.destroy = utils.toPromise(function (name, opts, callback) {
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (name && typeof name === 'object') {
    opts = name;
    name = undefined;
  }

  var backend = PouchDB.parseAdapter(opts.name || name, opts);
  var dbName = backend.name;
  var adapter = PouchDB.adapters[backend.adapter];
  var usePrefix = 'use_prefix' in adapter ? adapter.use_prefix : true;
  var baseName = usePrefix ?
    dbName.replace(new RegExp('^' + PouchDB.prefix), '') : dbName;
  var fullName = (backend.adapter === 'http' || backend.adapter === 'https' ?
      '' : (opts.prefix || '')) + dbName;
  function destroyDb() {
    // call destroy method of the particular adaptor
    adapter.destroy(fullName, opts, function (err, resp) {
      if (err) {
        callback(err);
      } else {
        PouchDB.emit('destroyed', name);
        //so we don't have to sift through all dbnames
        PouchDB.emit(name, 'destroyed');
        callback(null, resp || { 'ok': true });
      }
    });
  }

  var createOpts = utils.extend(true, {}, opts, {adapter : backend.adapter});
  new PouchDB(baseName, createOpts, function (err, db) {
    if (err) {
      return callback(err);
    }
    db.get('_local/_pouch_dependentDbs', function (err, localDoc) {
      if (err) {
        if (err.status !== 404) {
          return callback(err);
        } else { // no dependencies
          return destroyDb();
        }
      }
      var dependentDbs = localDoc.dependentDbs;
      var deletedMap = Object.keys(dependentDbs).map(function (name) {
        var trueName = usePrefix ?
          name.replace(new RegExp('^' + PouchDB.prefix), '') : name;
        var subOpts = utils.extend(true, opts, {adapter: backend.adapter});
        return PouchDB.destroy(trueName, subOpts);
      });
      Promise.all(deletedMap).then(destroyDb, function (error) {
        callback(error);
      });
    });
  });
});

PouchDB.allDbs = utils.toPromise(function (callback) {
  var err = new Error('allDbs method removed');
  err.stats = '400';
  callback(err);
});
PouchDB.adapter = function (id, obj) {
  if (obj.valid()) {
    PouchDB.adapters[id] = obj;
  }
};

PouchDB.plugin = function (obj) {
  Object.keys(obj).forEach(function (id) {
    PouchDB.prototype[id] = obj[id];
  });
};

PouchDB.defaults = function (defaultOpts) {
  function PouchAlt(name, opts, callback) {
    if (typeof opts === 'function' || typeof opts === 'undefined') {
      callback = opts;
      opts = {};
    }
    if (name && typeof name === 'object') {
      opts = name;
      name = undefined;
    }

    opts = utils.extend(true, {}, defaultOpts, opts);
    PouchDB.call(this, name, opts, callback);
  }

  utils.inherits(PouchAlt, PouchDB);

  PouchAlt.destroy = utils.toPromise(function (name, opts, callback) {
    if (typeof opts === 'function' || typeof opts === 'undefined') {
      callback = opts;
      opts = {};
    }

    if (name && typeof name === 'object') {
      opts = name;
      name = undefined;
    }
    opts = utils.extend(true, {}, defaultOpts, opts);
    return PouchDB.destroy(name, opts, callback);
  });

  eventEmitterMethods.forEach(function (method) {
    PouchAlt[method] = eventEmitter[method].bind(eventEmitter);
  });
  PouchAlt.setMaxListeners(0);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function (key) {
    if (!(key in PouchAlt)) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  return PouchAlt;
};

module.exports = PouchDB;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./adapters/preferredAdapters.js":4,"./constructor":8,"./utils":26,"events":30}],24:[function(_dereq_,module,exports){
'use strict';
var utils = _dereq_('./utils');
var replication = _dereq_('./replicate');
var replicate = replication.replicate;
var EE = _dereq_('events').EventEmitter;

utils.inherits(Sync, EE);
module.exports = sync;
function sync(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  opts = utils.clone(opts);
  /*jshint validthis:true */
  opts.PouchConstructor = opts.PouchConstructor || this;
  src = replication.toPouch(src, opts);
  target = replication.toPouch(target, opts);
  return new Sync(src, target, opts, callback);
}
function Sync(src, target, opts, callback) {
  var self = this;
  this.canceled = false;
  
  var onChange, complete;
  if ('onChange' in opts) {
    onChange = opts.onChange;
    delete opts.onChange;
  }
  if (typeof callback === 'function' && !opts.complete) {
    complete = callback;
  } else if ('complete' in opts) {
    complete = opts.complete;
    delete opts.complete;
  }

  this.push = replicate(src, target, opts);

  this.pull = replicate(target, src, opts);
  var emittedCancel = false;
  function onCancel(data) {
    if (!emittedCancel) {
      emittedCancel = true;
      self.emit('cancel', data);
    }
  }

  function pullChange(change) {
    self.emit('change', {
      direction: 'pull',
      change: change
    });
  }
  function pushChange(change) {
    self.emit('change', {
      direction: 'push',
      change: change
    });
  }
  var listeners = {};

  var removed = {};
  function removeAll(type) { // type is 'push' or 'pull'
    return function (event, func) {
      var isChange = event === 'change' &&
        (func === pullChange || func === pushChange);
      var isCancel = event === 'cancel' && func === onCancel;
      var isOtherEvent = event in listeners && func === listeners[event];

      if (isChange || isCancel || isOtherEvent) {
        if (!(event in removed)) {
          removed[event] = {};
        }
        removed[event][type] = true;
        if (Object.keys(removed[event]).length === 2) {
          // both push and pull have asked to be removed
          self.removeAllListeners(event);
        }
      }
    };
  }

  this.on('newListener', function (event) {
    if (event === 'change') {
      self.pull.on('change', pullChange);
      self.push.on('change', pushChange);
    } else if (event === 'cancel') {
      self.pull.on('cancel', onCancel);
      self.push.on('cancel', onCancel);
    } else if (event !== 'error' &&
      event !== 'removeListener' &&
      event !== 'complete' && !(event in listeners)) {
      listeners[event] = function (e) {
        self.emit(event, e);
      };
      self.pull.on(event, listeners[event]);
      self.push.on(event, listeners[event]);
    }
  });

  this.on('removeListener', function (event) {
    if (event === 'change') {
      self.pull.removeListener('change', pullChange);
      self.push.removeListener('change', pushChange);
    } else if (event === 'cancel') {
      self.pull.removeListener('cancel', onCancel);
      self.push.removeListener('cancel', onCancel);
    } else if (event in listeners) {
      if (typeof listeners[event] === 'function') {
        self.pull.removeListener(event, listeners[event]);
        self.push.removeListener(event, listeners[event]);
        delete listeners[event];
      }
    }
  });

  this.pull.on('removeListener', removeAll('pull'));
  this.push.on('removeListener', removeAll('push'));

  var promise = utils.Promise.all([
    this.push,
    this.pull
  ]).then(function (resp) {
    var out = {
      push: resp[0],
      pull: resp[1]
    };
    self.emit('complete', out);
    if (complete) {
      complete(null, out);
    }
    self.removeAllListeners();
    return out;
  }, function (err) {
    self.cancel();
    self.emit('error', err);
    if (complete) {
      complete(err);
    }
    self.removeAllListeners();
    throw err;
  });

  this.then = function (success, err) {
    return promise.then(success, err);
  };

  this["catch"] = function (err) {
    return promise["catch"](err);
  };
}

Sync.prototype.cancel = function () {
  if (!this.canceled) {
    this.canceled = true;
    this.push.cancel();
    this.pull.cancel();
  }
};

},{"./replicate":22,"./utils":26,"events":30}],25:[function(_dereq_,module,exports){
'use strict';

module.exports = TaskQueue;

function TaskQueue() {
  this.isReady = false;
  this.failed = false;
  this.queue = [];
}

TaskQueue.prototype.execute = function () {
  var d, func;
  if (this.failed) {
    while ((d = this.queue.shift())) {
      if (typeof d === 'function') {
        d(this.failed);
        continue;
      }
      func = d.parameters[d.parameters.length - 1];
      if (typeof func === 'function') {
        func(this.failed);
      } else if (d.name === 'changes' && typeof func.complete === 'function') {
        func.complete(this.failed);
      }
    }
  } else if (this.isReady) {
    while ((d = this.queue.shift())) {

      if (typeof d === 'function') {
        d();
      } else {
        d.task = this.db[d.name].apply(this.db, d.parameters);
      }
    }
  }
};

TaskQueue.prototype.fail = function (err) {
  this.failed = err;
  this.execute();
};

TaskQueue.prototype.ready = function (db) {
  if (this.failed) {
    return false;
  } else if (arguments.length === 0) {
    return this.isReady;
  }
  this.isReady = db ? true: false;
  this.db = db;
  this.execute();
};

TaskQueue.prototype.addTask = function (name, parameters) {
  if (typeof name === 'function') {
    this.queue.push(name);
    if (this.failed) {
      this.execute();
    }
  } else {
    var task = { name: name, parameters: parameters };
    this.queue.push(task);
    if (this.failed) {
      this.execute();
    }
    return task;
  }
};

},{}],26:[function(_dereq_,module,exports){
(function (process,global){
/*jshint strict: false */
/*global chrome */
var merge = _dereq_('./merge');
exports.extend = _dereq_('pouchdb-extend');
exports.ajax = _dereq_('./deps/ajax');
exports.createBlob = _dereq_('./deps/blob');
exports.uuid = _dereq_('./deps/uuid');
exports.getArguments = _dereq_('argsarray');
var buffer = _dereq_('./deps/buffer');
var errors = _dereq_('./deps/errors');
var EventEmitter = _dereq_('events').EventEmitter;
var collections = _dereq_('./deps/collections');
exports.Map = collections.Map;
exports.Set = collections.Set;

if (typeof global.Promise === 'function') {
  exports.Promise = global.Promise;
} else {
  exports.Promise = _dereq_('bluebird');
}
var Promise = exports.Promise;

function toObject(array) {
  var obj = {};
  array.forEach(function (item) { obj[item] = true; });
  return obj;
}
// List of top level reserved words for doc
var reservedWords = toObject([
  '_id',
  '_rev',
  '_attachments',
  '_deleted',
  '_revisions',
  '_revs_info',
  '_conflicts',
  '_deleted_conflicts',
  '_local_seq',
  '_rev_tree',
  //replication documents
  '_replication_id',
  '_replication_state',
  '_replication_state_time',
  '_replication_state_reason',
  '_replication_stats'
]);

// List of reserved words that should end up the document
var dataWords = toObject([
  '_attachments',
  //replication documents
  '_replication_id',
  '_replication_state',
  '_replication_state_time',
  '_replication_state_reason',
  '_replication_stats'
]);

exports.lastIndexOf = function (str, char) {
  for (var i = str.length - 1; i >= 0; i--) {
    if (str.charAt(i) === char) {
      return i;
    }
  }
  return -1;
};
exports.clone = function (obj) {
  return exports.extend(true, {}, obj);
};
exports.inherits = _dereq_('inherits');
// Determine id an ID is valid
//   - invalid IDs begin with an underescore that does not begin '_design' or
//     '_local'
//   - any other string value is a valid id
// Returns the specific error object for each case
exports.invalidIdError = function (id) {
  var err;
  if (!id) {
    err = new TypeError(errors.MISSING_ID.message);
    err.status = 412;
  } else if (typeof id !== 'string') {
    err = new TypeError(errors.INVALID_ID.message);
    err.status = 400;
  } else if (/^_/.test(id) && !(/^_(design|local)/).test(id)) {
    err = new TypeError(errors.RESERVED_ID.message);
    err.status = 400;
  }
  if (err) {
    throw err;
  }
};

function isChromeApp() {
  return (typeof chrome !== "undefined" &&
          typeof chrome.storage !== "undefined" &&
          typeof chrome.storage.local !== "undefined");
}

// Pretty dumb name for a function, just wraps callback calls so we dont
// to if (callback) callback() everywhere
exports.call = exports.getArguments(function (args) {
  if (!args.length) {
    return;
  }
  var fun = args.shift();
  if (typeof fun === 'function') {
    fun.apply(this, args);
  }
});

exports.isLocalId = function (id) {
  return (/^_local/).test(id);
};

// check if a specific revision of a doc has been deleted
//  - metadata: the metadata object from the doc store
//  - rev: (optional) the revision to check. defaults to winning revision
exports.isDeleted = function (metadata, rev) {
  if (!rev) {
    rev = merge.winningRev(metadata);
  }
  var dashIndex = rev.indexOf('-');
  if (dashIndex !== -1) {
    rev = rev.substring(dashIndex + 1);
  }
  var deleted = false;
  merge.traverseRevTree(metadata.rev_tree,
  function (isLeaf, pos, id, acc, opts) {
    if (id === rev) {
      deleted = !!opts.deleted;
    }
  });

  return deleted;
};

exports.revExists = function (metadata, rev) {
  var found = false;
  merge.traverseRevTree(metadata.rev_tree, function (leaf, pos, id, acc, opts) {
    if ((pos + '-' + id) === rev) {
      found = true;
    }
  });
  return found;
};

exports.filterChange = function (opts) {
  return function (change) {
    var req = {};
    var hasFilter = opts.filter && typeof opts.filter === 'function';

    req.query = opts.query_params;
    if (opts.filter && hasFilter && !opts.filter.call(this, change.doc, req)) {
      return false;
    }
    if (opts.doc_ids && opts.doc_ids.indexOf(change.id) === -1) {
      return false;
    }
    if (!opts.include_docs) {
      delete change.doc;
    } else {
      for (var att in change.doc._attachments) {
        if (change.doc._attachments.hasOwnProperty(att)) {
          change.doc._attachments[att].stub = true;
        }
      }
    }
    return true;
  };
};

// Preprocess documents, parse their revisions, assign an id and a
// revision for new writes that are missing them, etc
exports.parseDoc = function (doc, newEdits) {
  var nRevNum;
  var newRevId;
  var revInfo;
  var error;
  var opts = {status: 'available'};
  if (doc._deleted) {
    opts.deleted = true;
  }

  if (newEdits) {
    if (!doc._id) {
      doc._id = exports.uuid();
    }
    newRevId = exports.uuid(32, 16).toLowerCase();
    if (doc._rev) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) {
        var err = new TypeError("invalid value for property '_rev'");
        err.status = 400;
      }
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], {status: 'missing'}, [[newRevId, opts, []]]]
      }];
      nRevNum = parseInt(revInfo[1], 10) + 1;
    } else {
      doc._rev_tree = [{
        pos: 1,
        ids : [newRevId, opts, []]
      }];
      nRevNum = 1;
    }
  } else {
    if (doc._revisions) {
      doc._rev_tree = [{
        pos: doc._revisions.start - doc._revisions.ids.length + 1,
        ids: doc._revisions.ids.reduce(function (acc, x) {
          if (acc === null) {
            return [x, opts, []];
          } else {
            return [x, {status: 'missing'}, [acc]];
          }
        }, null)
      }];
      nRevNum = doc._revisions.start;
      newRevId = doc._revisions.ids[0];
    }
    if (!doc._rev_tree) {
      revInfo = /^(\d+)-(.+)$/.exec(doc._rev);
      if (!revInfo) {
        error = new TypeError(errors.BAD_ARG.message);
        error.status = errors.BAD_ARG.status;
        throw error;
      }
      nRevNum = parseInt(revInfo[1], 10);
      newRevId = revInfo[2];
      doc._rev_tree = [{
        pos: parseInt(revInfo[1], 10),
        ids: [revInfo[2], opts, []]
      }];
    }
  }

  exports.invalidIdError(doc._id);

  doc._rev = [nRevNum, newRevId].join('-');

  var result = {metadata : {}, data : {}};
  for (var key in doc) {
    if (doc.hasOwnProperty(key)) {
      var specialKey = key[0] === '_';
      if (specialKey && !reservedWords[key]) {
        error = new Error(errors.DOC_VALIDATION.message + ': ' + key);
        error.status = errors.DOC_VALIDATION.status;
        throw error;
      } else if (specialKey && !dataWords[key]) {
        result.metadata[key.slice(1)] = doc[key];
      } else {
        result.data[key] = doc[key];
      }
    }
  }
  return result;
};

exports.isCordova = function () {
  return (typeof cordova !== "undefined" ||
          typeof PhoneGap !== "undefined" ||
          typeof phonegap !== "undefined");
};

exports.hasLocalStorage = function () {
  if (isChromeApp()) {
    return false;
  }
  try {
    return global.localStorage;
  } catch (e) {
    return false;
  }
};
exports.Changes = Changes;
exports.inherits(Changes, EventEmitter);
function Changes() {
  if (!(this instanceof Changes)) {
    return new Changes();
  }
  var self = this;
  EventEmitter.call(this);
  this.isChrome = isChromeApp();
  this.listeners = {};
  this.hasLocal = false;
  if (!this.isChrome) {
    this.hasLocal = exports.hasLocalStorage();
  }
  if (this.isChrome) {
    chrome.storage.onChanged.addListener(function (e) {
      // make sure it's event addressed to us
      if (e.db_name != null) {
        //object only has oldValue, newValue members
        self.emit(e.dbName.newValue);
      }
    });
  } else if (this.hasLocal) {
    if (global.addEventListener) {
      global.addEventListener("storage", function (e) {
        self.emit(e.key);
      });
    } else {
      global.attachEvent("storage", function (e) {
        self.emit(e.key);
      });
    }
  }

}
Changes.prototype.addListener = function (dbName, id, db, opts) {
  if (this.listeners[id]) {
    return;
  }
  function eventFunction() {
    db.changes({
      include_docs: opts.include_docs,
      conflicts: opts.conflicts,
      continuous: false,
      descending: false,
      filter: opts.filter,
      view: opts.view,
      since: opts.since,
      query_params: opts.query_params,
      onChange: function (c) {
        if (c.seq > opts.since && !opts.cancelled) {
          opts.since = c.seq;
          exports.call(opts.onChange, c);
        }
      }
    });
  }
  this.listeners[id] = eventFunction;
  this.on(dbName, eventFunction);
};

Changes.prototype.removeListener = function (dbName, id) {
  if (!(id in this.listeners)) {
    return;
  }
  EventEmitter.prototype.removeListener.call(this, dbName,
    this.listeners[id]);
};


Changes.prototype.notifyLocalWindows = function (dbName) {
  //do a useless change on a storage thing
  //in order to get other windows's listeners to activate
  if (this.isChrome) {
    chrome.storage.local.set({dbName: dbName});
  } else if (this.hasLocal) {
    localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
  }
};

Changes.prototype.notify = function (dbName) {
  this.emit(dbName);
  this.notifyLocalWindows(dbName);
};

if (!process.browser || !('atob' in global)) {
  exports.atob = function (str) {
    var base64 = new buffer(str, 'base64');
    // Node.js will just skip the characters it can't encode instead of
    // throwing and exception
    if (base64.toString('base64') !== str) {
      throw ("Cannot base64 encode full string");
    }
    return base64.toString('binary');
  };
} else {
  exports.atob = function (str) {
    return atob(str);
  };
}

if (!process.browser || !('btoa' in global)) {
  exports.btoa = function (str) {
    return new buffer(str, 'binary').toString('base64');
  };
} else {
  exports.btoa = function (str) {
    return btoa(str);
  };
}

// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
exports.fixBinary = function (bin) {
  if (!process.browser) {
    // don't need to do this in Node
    return bin;
  }

  var length = bin.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  for (var i = 0; i < length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return buf;
};

// shim for browsers that don't support it
exports.readAsBinaryString = function (blob, callback) {
  var reader = new FileReader();
  var hasBinaryString = typeof reader.readAsBinaryString === 'function';
  reader.onloadend = function (e) {
    var result = e.target.result || '';
    if (hasBinaryString) {
      return callback(result);
    }
    callback(exports.arrayBufferToBinaryString(result));
  };
  if (hasBinaryString) {
    reader.readAsBinaryString(blob);
  } else {
    reader.readAsArrayBuffer(blob);
  }
};

exports.once = function (fun) {
  var called = false;
  return exports.getArguments(function (args) {
    if (called) {
      throw new Error('once called  more than once');
    } else {
      called = true;
      fun.apply(this, args);
    }
  });
};

exports.toPromise = function (func) {
  //create the function we will be returning
  return exports.getArguments(function (args) {
    var self = this;
    var tempCB =
      (typeof args[args.length - 1] === 'function') ? args.pop() : false;
    // if the last argument is a function, assume its a callback
    var usedCB;
    if (tempCB) {
      // if it was a callback, create a new callback which calls it,
      // but do so async so we don't trap any errors
      usedCB = function (err, resp) {
        process.nextTick(function () {
          tempCB(err, resp);
        });
      };
    }
    var promise = new Promise(function (fulfill, reject) {
      var resp;
      try {
        var callback = exports.once(function (err, mesg) {
          if (err) {
            reject(err);
          } else {
            fulfill(mesg);
          }
        });
        // create a callback for this invocation
        // apply the function in the orig context
        args.push(callback);
        resp = func.apply(self, args);
        if (resp && typeof resp.then === 'function') {
          fulfill(resp);
        }
      } catch (e) {
        reject(e);
      }
    });
    // if there is a callback, call it back
    if (usedCB) {
      promise.then(function (result) {
        usedCB(null, result);
      }, usedCB);
    }
    promise.cancel = function () {
      return this;
    };
    return promise;
  });
};

exports.adapterFun = function (name, callback) {
  return exports.toPromise(exports.getArguments(function (args) {
    if (this._closed) {
      return Promise.reject(new Error('database is closed'));
    }
    var self = this;
    if (!this.taskqueue.isReady) {
      return new exports.Promise(function (fulfill, reject) {
        self.taskqueue.addTask(function (failed) {
          if (failed) {
            reject(failed);
          } else {
            fulfill(self[name].apply(self, args));
          }
        });
      });
    }
    return callback.apply(this, args);
  }));
};
//Can't find original post, but this is close
//http://stackoverflow.com/questions/6965107/ (continues on next line)
//converting-between-strings-and-arraybuffers
exports.arrayBufferToBinaryString = function (buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var length = bytes.byteLength;
  for (var i = 0; i < length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
};

exports.cancellableFun = function (fun, self, opts) {

  opts = opts ? exports.clone(true, {}, opts) : {};

  var emitter = new EventEmitter();
  var oldComplete = opts.complete || function () { };
  var complete = opts.complete = exports.once(function (err, resp) {
    if (err) {
      oldComplete(err);
    } else {
      emitter.emit('end', resp);
      oldComplete(null, resp);
    }
    emitter.removeAllListeners();
  });
  var oldOnChange = opts.onChange || function () {};
  var lastChange = 0;
  self.on('destroyed', function () {
    emitter.removeAllListeners();
  });
  opts.onChange = function (change) {
    oldOnChange(change);
    if (change.seq <= lastChange) {
      return;
    }
    lastChange = change.seq;
    emitter.emit('change', change);
    if (change.deleted) {
      emitter.emit('delete', change);
    } else if (change.changes.length === 1 &&
      change.changes[0].rev.slice(0, 1) === '1-') {
      emitter.emit('create', change);
    } else {
      emitter.emit('update', change);
    }
  };
  var promise = new Promise(function (fulfill, reject) {
    opts.complete = function (err, res) {
      if (err) {
        reject(err);
      } else {
        fulfill(res);
      }
    };
  });

  promise.then(function (result) {
    complete(null, result);
  }, complete);

  // this needs to be overwridden by caller, dont fire complete until
  // the task is ready
  promise.cancel = function () {
    promise.isCancelled = true;
    if (self.taskqueue.isReady) {
      opts.complete(null, {status: 'cancelled'});
    }
  };

  if (!self.taskqueue.isReady) {
    self.taskqueue.addTask(function () {
      if (promise.isCancelled) {
        opts.complete(null, {status: 'cancelled'});
      } else {
        fun(self, opts, promise);
      }
    });
  } else {
    fun(self, opts, promise);
  }
  promise.on = emitter.on.bind(emitter);
  promise.once = emitter.once.bind(emitter);
  promise.addListener = emitter.addListener.bind(emitter);
  promise.removeListener = emitter.removeListener.bind(emitter);
  promise.removeAllListeners = emitter.removeAllListeners.bind(emitter);
  promise.setMaxListeners = emitter.setMaxListeners.bind(emitter);
  promise.listeners = emitter.listeners.bind(emitter);
  promise.emit = emitter.emit.bind(emitter);
  return promise;
};

exports.MD5 = exports.toPromise(_dereq_('./deps/md5'));

// designed to give info to browser users, who are disturbed
// when they see 404s in the console
exports.explain404 = function (str) {
  if (process.browser && 'console' in global && 'info' in console) {
    console.info('The above 404 is totally normal. ' +
      str + '\n\u2665 the PouchDB team');
  }
};

exports.parseUri = _dereq_('./deps/parse-uri');

exports.compare = function (left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
};
}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./deps/ajax":9,"./deps/blob":10,"./deps/buffer":29,"./deps/collections":11,"./deps/errors":12,"./deps/md5":13,"./deps/parse-uri":15,"./deps/uuid":17,"./merge":21,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"argsarray":28,"bluebird":36,"events":30,"inherits":32,"pouchdb-extend":51}],27:[function(_dereq_,module,exports){
module.exports = "3.1.0";

},{}],28:[function(_dereq_,module,exports){
'use strict';

module.exports = argsArray;

function argsArray(fun) {
  return function () {
    var len = arguments.length;
    if (len) {
      var args = [];
      var i = -1;
      while (++i < len) {
        args[i] = arguments[i];
      }
      return fun.call(this, args);
    } else {
      return fun.call(this, []);
    }
  };
}
},{}],29:[function(_dereq_,module,exports){

},{}],30:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],31:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],32:[function(_dereq_,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],33:[function(_dereq_,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],34:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('./promise');
var reject = _dereq_('./reject');
var resolve = _dereq_('./resolve');
var INTERNAL = _dereq_('./INTERNAL');
var handlers = _dereq_('./handlers');
module.exports = all;
function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len & !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}
},{"./INTERNAL":33,"./handlers":35,"./promise":37,"./reject":40,"./resolve":41}],35:[function(_dereq_,module,exports){
'use strict';
var tryCatch = _dereq_('./tryCatch');
var resolveThenable = _dereq_('./resolveThenable');
var states = _dereq_('./states');

exports.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return exports.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    resolveThenable.safely(self, thenable);
  } else {
    self.state = states.FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
exports.reject = function (self, error) {
  self.state = states.REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{"./resolveThenable":42,"./states":43,"./tryCatch":44}],36:[function(_dereq_,module,exports){
module.exports = exports = _dereq_('./promise');

exports.resolve = _dereq_('./resolve');
exports.reject = _dereq_('./reject');
exports.all = _dereq_('./all');
exports.race = _dereq_('./race');
},{"./all":34,"./promise":37,"./race":39,"./reject":40,"./resolve":41}],37:[function(_dereq_,module,exports){
'use strict';

var unwrap = _dereq_('./unwrap');
var INTERNAL = _dereq_('./INTERNAL');
var resolveThenable = _dereq_('./resolveThenable');
var states = _dereq_('./states');
var QueueItem = _dereq_('./queueItem');

module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('reslover must be a function');
  }
  this.state = states.PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    resolveThenable.safely(this, resolver);
  }
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
    typeof onRejected !== 'function' && this.state === states.REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  
  if (this.state !== states.PENDING) {
    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};

},{"./INTERNAL":33,"./queueItem":38,"./resolveThenable":42,"./states":43,"./unwrap":45}],38:[function(_dereq_,module,exports){
'use strict';
var handlers = _dereq_('./handlers');
var unwrap = _dereq_('./unwrap');

module.exports = QueueItem;
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
},{"./handlers":35,"./unwrap":45}],39:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('./promise');
var reject = _dereq_('./reject');
var resolve = _dereq_('./resolve');
var INTERNAL = _dereq_('./INTERNAL');
var handlers = _dereq_('./handlers');
module.exports = race;
function race(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}
},{"./INTERNAL":33,"./handlers":35,"./promise":37,"./reject":40,"./resolve":41}],40:[function(_dereq_,module,exports){
'use strict';

var Promise = _dereq_('./promise');
var INTERNAL = _dereq_('./INTERNAL');
var handlers = _dereq_('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":33,"./handlers":35,"./promise":37}],41:[function(_dereq_,module,exports){
'use strict';

var Promise = _dereq_('./promise');
var INTERNAL = _dereq_('./INTERNAL');
var handlers = _dereq_('./handlers');
module.exports = resolve;

var FALSE = handlers.resolve(new Promise(INTERNAL), false);
var NULL = handlers.resolve(new Promise(INTERNAL), null);
var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');

function resolve(value) {
  if (value) {
    if (value instanceof Promise) {
      return value;
    }
    return handlers.resolve(new Promise(INTERNAL), value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":33,"./handlers":35,"./promise":37}],42:[function(_dereq_,module,exports){
'use strict';
var handlers = _dereq_('./handlers');
var tryCatch = _dereq_('./tryCatch');
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }
  
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}
exports.safely = safelyResolveThenable;
},{"./handlers":35,"./tryCatch":44}],43:[function(_dereq_,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],44:[function(_dereq_,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],45:[function(_dereq_,module,exports){
'use strict';

var immediate = _dereq_('immediate');
var handlers = _dereq_('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":35,"immediate":46}],46:[function(_dereq_,module,exports){
'use strict';
var types = [
  _dereq_('./nextTick'),
  _dereq_('./mutation.js'),
  _dereq_('./messageChannel'),
  _dereq_('./stateChange'),
  _dereq_('./timeout')
];
var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}
var scheduleDrain;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i] && types[i].test && types[i].test()) {
    scheduleDrain = types[i].install(nextTick);
    break;
  }
}
module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}
},{"./messageChannel":47,"./mutation.js":48,"./nextTick":29,"./stateChange":49,"./timeout":50}],47:[function(_dereq_,module,exports){
(function (global){
'use strict';

exports.test = function () {
  if (global.setImmediate) {
    // we can only get here in IE10
    // which doesn't handel postMessage well
    return false;
  }
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],48:[function(_dereq_,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(_dereq_,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],50:[function(_dereq_,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],51:[function(_dereq_,module,exports){
"use strict";

// Extends method
// (taken from http://code.jquery.com/jquery-1.9.0.js)
// Populate the class2type map
var class2type = {};

var types = [
  "Boolean", "Number", "String", "Function", "Array",
  "Date", "RegExp", "Object", "Error"
];
for (var i = 0; i < types.length; i++) {
  var typename = types[i];
  class2type["[object " + typename + "]"] = typename.toLowerCase();
}

var core_toString = class2type.toString;
var core_hasOwn = class2type.hasOwnProperty;

function type(obj) {
  if (obj === null) {
    return String(obj);
  }
  return typeof obj === "object" || typeof obj === "function" ?
    class2type[core_toString.call(obj)] || "object" :
    typeof obj;
}

function isWindow(obj) {
  return obj !== null && obj === obj.window;
}

function isPlainObject(obj) {
  // Must be an Object.
  // Because of IE, we also have to check the presence of
  // the constructor property.
  // Make sure that DOM nodes and window objects don't pass through, as well
  if (!obj || type(obj) !== "object" || obj.nodeType || isWindow(obj)) {
    return false;
  }

  try {
    // Not own constructor property must be Object
    if (obj.constructor &&
      !core_hasOwn.call(obj, "constructor") &&
      !core_hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
      return false;
    }
  } catch ( e ) {
    // IE8,9 Will throw exceptions on certain host objects #9897
    return false;
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.
  var key;
  for (key in obj) {}

  return key === undefined || core_hasOwn.call(obj, key);
}


function isFunction(obj) {
  return type(obj) === "function";
}

var isArray = Array.isArray || function (obj) {
  return type(obj) === "array";
};

function extend() {
  // originally extend() was recursive, but this ended up giving us
  // "call stack exceeded", so it's been unrolled to use a literal stack
  // (see https://github.com/pouchdb/pouchdb/issues/2543)
  var stack = [];
  var i = -1;
  var len = arguments.length;
  var args = new Array(len);
  while (++i < len) {
    args[i] = arguments[i];
  }
  var container = {};
  stack.push({args: args, result: {container: container, key: 'key'}});
  var next;
  while ((next = stack.pop())) {
    extendInner(stack, next.args, next.result);
  }
  return container.key;
}

function extendInner(stack, args, result) {
  var options, name, src, copy, copyIsArray, clone,
    target = args[0] || {},
    i = 1,
    length = args.length,
    deep = false,
    numericStringRegex = /\d+/,
    optionsIsArray;

  // Handle a deep copy situation
  if (typeof target === "boolean") {
    deep = target;
    target = args[1] || {};
    // skip the boolean and the target
    i = 2;
  }

  // Handle case when target is a string or something (possible in deep copy)
  if (typeof target !== "object" && !isFunction(target)) {
    target = {};
  }

  // extend jQuery itself if only one argument is passed
  if (length === i) {
    /* jshint validthis: true */
    target = this;
    --i;
  }

  for (; i < length; i++) {
    // Only deal with non-null/undefined values
    if ((options = args[i]) != null) {
      optionsIsArray = isArray(options);
      // Extend the base object
      for (name in options) {
        //if (options.hasOwnProperty(name)) {
        if (!(name in Object.prototype)) {
          if (optionsIsArray && !numericStringRegex.test(name)) {
            continue;
          }

          src = target[name];
          copy = options[name];

          // Prevent never-ending loop
          if (target === copy) {
            continue;
          }

          // Recurse if we're merging plain objects or arrays
          if (deep && copy && (isPlainObject(copy) ||
              (copyIsArray = isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && isArray(src) ? src : [];

            } else {
              clone = src && isPlainObject(src) ? src : {};
            }

            // Never move original objects, clone them
            stack.push({
              args: [deep, clone, copy],
              result: {
                container: target,
                key: name
              }
            });

          // Don't bring in undefined values
          } else if (copy !== undefined) {
            if (!(isArray(options) && isFunction(copy))) {
              target[name] = copy;
            }
          }
        }
      }
    }
  }

  // "Return" the modified object by setting the key
  // on the given container
  result.container[result.key] = target;
}


module.exports = extend;



},{}],52:[function(_dereq_,module,exports){
'use strict';

var upsert = _dereq_('./upsert');
var utils = _dereq_('./utils');
var Promise = utils.Promise;

module.exports = function (opts) {
  var sourceDB = opts.db;
  var viewName = opts.viewName;
  var mapFun = opts.map;
  var reduceFun = opts.reduce;
  var temporary = opts.temporary;

  // the "undefined" part is for backwards compatibility
  var viewSignature = mapFun.toString() + (reduceFun && reduceFun.toString()) +
    'undefined';

  if (!temporary && sourceDB._cachedViews) {
    var cachedView = sourceDB._cachedViews[viewSignature];
    if (cachedView) {
      return Promise.resolve(cachedView);
    }
  }

  return sourceDB.info().then(function (info) {

    var depDbName = info.db_name + '-mrview-' +
      (temporary ? 'temp' : utils.MD5(viewSignature));

    // save the view name in the source PouchDB so it can be cleaned up if necessary
    // (e.g. when the _design doc is deleted, remove all associated view data)
    function diffFunction(doc) {
      doc.views = doc.views || {};
      var fullViewName = viewName;
      if (fullViewName.indexOf('/') === -1) {
        fullViewName = viewName + '/' + viewName;
      }
      var depDbs = doc.views[fullViewName] = doc.views[fullViewName] || {};
      /* istanbul ignore if */
      if (depDbs[depDbName]) {
        return; // no update necessary
      }
      depDbs[depDbName] = true;
      return doc;
    }
    return upsert(sourceDB, '_local/mrviews', diffFunction).then(function () {
      return sourceDB.registerDependentDatabase(depDbName).then(function (res) {
        var db = res.db;
        db.auto_compaction = true;
        var view = {
          name: depDbName,
          db: db, 
          sourceDB: sourceDB,
          adapter: sourceDB.adapter,
          mapFun: mapFun,
          reduceFun: reduceFun
        };
        return view.db.get('_local/lastSeq')["catch"](function (err) {
          /* istanbul ignore if */
          if (err.status !== 404) {
            throw err;
          }
        }).then(function (lastSeqDoc) {
          view.seq = lastSeqDoc ? lastSeqDoc.seq : 0;
          if (!temporary) {
            sourceDB._cachedViews = sourceDB._cachedViews || {};
            sourceDB._cachedViews[viewSignature] = view;
            view.db.on('destroyed', function () {
              delete sourceDB._cachedViews[viewSignature];
            });
          }
          return view;
        });
      });
    });
  });
};

},{"./upsert":58,"./utils":59}],53:[function(_dereq_,module,exports){
'use strict';

module.exports = function (func, emit, sum, log, isArray, toJSON) {
  /*jshint evil:true,unused:false */
  return eval("'use strict'; (" + func.replace(/;\s*$/, "") + ");");
};

},{}],54:[function(_dereq_,module,exports){
(function (process){
'use strict';

var pouchCollate = _dereq_('pouchdb-collate');
var TaskQueue = _dereq_('./taskqueue');
var collate = pouchCollate.collate;
var toIndexableString = pouchCollate.toIndexableString;
var normalizeKey = pouchCollate.normalizeKey;
var createView = _dereq_('./create-view');
var evalFunc = _dereq_('./evalfunc');
var log; 
/* istanbul ignore else */
if ((typeof console !== 'undefined') && (typeof console.log === 'function')) {
  log = Function.prototype.bind.call(console.log, console);
} else {
  log = function () {};
}
var utils = _dereq_('./utils');
var Promise = utils.Promise;
var mainQueue = new TaskQueue();
var tempViewQueue = new TaskQueue();
var CHANGES_BATCH_SIZE = 50;

function parseViewName(name) {
  // can be either 'ddocname/viewname' or just 'viewname'
  // (where the ddoc name is the same)
  return name.indexOf('/') === -1 ? [name, name] : name.split('/');
}

function tryCode(db, fun, args) {
  // emit an event if there was an error thrown by a map/reduce function.
  // putting try/catches in a single function also avoids deoptimizations.
  try {
    return {
      output : fun.apply(null, args)
    };
  } catch (e) {
    db.emit('error', e);
    return {error : e};
  }
}

function sortByKeyThenValue(x, y) {
  var keyCompare = collate(x.key, y.key);
  return keyCompare !== 0 ? keyCompare : collate(x.value, y.value);
}

function sliceResults(results, limit, skip) {
  skip = skip || 0;
  if (typeof limit === 'number') {
    return results.slice(skip, limit + skip);
  } else if (skip > 0) {
    return results.slice(skip);
  }
  return results;
}

function createBuiltInError(name) {
  var error = new Error('builtin ' + name +
    ' function requires map values to be numbers' +
    ' or number arrays');
  error.name = 'invalid_value';
  error.status = 500;
  return error;
}

function sum(values) {
  var result = 0;
  for (var i = 0, len = values.length; i < len; i++) {
    var num = values[i];
    if (typeof num !== 'number') {
      if (Array.isArray(num)) {
        // lists of numbers are also allowed, sum them separately
        result = typeof result === 'number' ? [result] : result;
        for (var j = 0, jLen = num.length; j < jLen; j++) {
          var jNum = num[j];
          if (typeof jNum !== 'number') {
            throw createBuiltInError('_sum');
          } else if (typeof result[j] === 'undefined') {
            result.push(jNum);
          } else {
            result[j] += jNum;
          }
        }
      } else { // not array/number
        throw createBuiltInError('_sum');
      }
    } else if (typeof result === 'number') {
      result += num;
    } else { // add number to array
      result[0] += num;
    }
  }
  return result;
}

var builtInReduce = {
  _sum: function (keys, values) {
    return sum(values);
  },

  _count: function (keys, values) {
    return values.length;
  },

  _stats: function (keys, values) {
    // no need to implement rereduce=true, because Pouch
    // will never call it
    function sumsqr(values) {
      var _sumsqr = 0;
      for (var i = 0, len = values.length; i < len; i++) {
        var num = values[i];
        _sumsqr += (num * num);
      }
      return _sumsqr;
    }
    return {
      sum     : sum(values),
      min     : Math.min.apply(null, values),
      max     : Math.max.apply(null, values),
      count   : values.length,
      sumsqr : sumsqr(values)
    };
  }
};

function addHttpParam(paramName, opts, params, asJson) {
  // add an http param from opts to params, optionally json-encoded
  var val = opts[paramName];
  if (typeof val !== 'undefined') {
    if (asJson) {
      val = encodeURIComponent(JSON.stringify(val));
    }
    params.push(paramName + '=' + val);
  }
}

function checkQueryParseError(options, fun) {
  var startkeyName = options.descending ? 'endkey' : 'startkey';
  var endkeyName = options.descending ? 'startkey' : 'endkey';

  if (typeof options[startkeyName] !== 'undefined' &&
    typeof options[endkeyName] !== 'undefined' &&
    collate(options[startkeyName], options[endkeyName]) > 0) {
    throw new QueryParseError('No rows can match your key range, reverse your ' +
        'start_key and end_key or set {descending : true}');
  } else if (fun.reduce && options.reduce !== false) {
    if (options.include_docs) {
      throw new QueryParseError('{include_docs:true} is invalid for reduce');
    } else if (options.keys && options.keys.length > 1 &&
        !options.group && !options.group_level) {
      throw new QueryParseError('Multi-key fetches for reduce views must use {group: true}');
    }
  }
  if (options.group_level) {
    if (typeof options.group_level !== 'number') {
      throw new QueryParseError('Invalid value for integer: "' + options.group_level + '"');
    }
    if (options.group_level < 0) {
      throw new QueryParseError('Invalid value for positive integer: ' +
        '"' + options.group_level + '"');
    }
  }
}

function httpQuery(db, fun, opts) {
  // List of parameters to add to the PUT request
  var params = [];
  var body;
  var method = 'GET';

  // If opts.reduce exists and is defined, then add it to the list
  // of parameters.
  // If reduce=false then the results are that of only the map function
  // not the final result of map and reduce.
  addHttpParam('reduce', opts, params);
  addHttpParam('include_docs', opts, params);
  addHttpParam('limit', opts, params);
  addHttpParam('descending', opts, params);
  addHttpParam('group', opts, params);
  addHttpParam('group_level', opts, params);
  addHttpParam('skip', opts, params);
  addHttpParam('stale', opts, params);
  addHttpParam('conflicts', opts, params);
  addHttpParam('startkey', opts, params, true);
  addHttpParam('endkey', opts, params, true);
  addHttpParam('inclusive_end', opts, params);
  addHttpParam('key', opts, params, true);

  // Format the list of parameters into a valid URI query string
  params = params.join('&');
  params = params === '' ? '' : '?' + params;

  // If keys are supplied, issue a POST request to circumvent GET query string limits
  // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
  if (typeof opts.keys !== 'undefined') {
    var MAX_URL_LENGTH = 2000;
    // according to http://stackoverflow.com/a/417184/680742,
    // the de facto URL length limit is 2000 characters

    var keysAsString =
      'keys=' + encodeURIComponent(JSON.stringify(opts.keys));
    if (keysAsString.length + params.length + 1 <= MAX_URL_LENGTH) {
      // If the keys are short enough, do a GET. we do this to work around
      // Safari not understanding 304s on POSTs (see pouchdb/pouchdb#1239)
      params += (params[0] === '?' ? '&' : '?') + keysAsString;
    } else {
      method = 'POST';
      if (typeof fun === 'string') {
        body = JSON.stringify({keys: opts.keys});
      } else { // fun is {map : mapfun}, so append to this
        fun.keys = opts.keys;
      }
    }
  }

  // We are referencing a query defined in the design doc
  if (typeof fun === 'string') {
    var parts = parseViewName(fun);
    return db.request({
      method: method,
      url: '_design/' + parts[0] + '/_view/' + parts[1] + params,
      body: body
    });
  }

  // We are using a temporary view, terrible for performance but good for testing
  body = body || {};
  Object.keys(fun).forEach(function (key) {
    if (Array.isArray(fun[key])) {
      body[key] = fun[key];
    } else {
      body[key] = fun[key].toString();
    }
  });
  return db.request({
    method: 'POST',
    url: '_temp_view' + params,
    body: body
  });
}

function defaultsTo(value) {
  return function (reason) {
    /* istanbul ignore else */
    if (reason.status === 404) {
      return value;
    } else {
      throw reason;
    }
  };
}

// returns a promise for a list of docs to update, based on the input docId.
// we update the metaDoc first (i.e. the doc that points from the sourceDB
// document Id to the ids of the documents in the mrview database), then
// the key/value docs.  that way, if lightning strikes the user's computer
// in the middle of an update, we don't write any docs that we wouldn't
// be able to find later using the metaDoc.
function getDocsToPersist(docId, view, docIdsToEmits) {
  var metaDocId = '_local/doc_' + docId;
  return view.db.get(metaDocId)[
    "catch"](defaultsTo({_id: metaDocId, keys: []}))
    .then(function (metaDoc) {
      return Promise.resolve().then(function () {
        if (metaDoc.keys.length) {
          return view.db.allDocs({
            keys: metaDoc.keys,
            include_docs: true
          });
        }
        return {rows: []}; // no keys, no need for a lookup
      }).then(function (res) {
        var kvDocs = res.rows.map(function (row) {
          return row.doc;
        }).filter(function (row) {
          return row;
        });

        var indexableKeysToKeyValues = docIdsToEmits[docId];
        var oldKeysMap = {};
        kvDocs.forEach(function (kvDoc) {
          oldKeysMap[kvDoc._id] = true;
          kvDoc._deleted = !indexableKeysToKeyValues[kvDoc._id];
          if (!kvDoc._deleted) {
            var keyValue = indexableKeysToKeyValues[kvDoc._id];
            if ('value' in keyValue) {
              kvDoc.value = keyValue.value;
            }
          }
        });

        var newKeys = Object.keys(indexableKeysToKeyValues);
        newKeys.forEach(function (key) {
          if (!oldKeysMap[key]) {
            // new doc
            var kvDoc = {
              _id: key
            };
            var keyValue = indexableKeysToKeyValues[key];
            if ('value' in keyValue) {
              kvDoc.value = keyValue.value;
            }
            kvDocs.push(kvDoc);
          }
        });
        metaDoc.keys = utils.uniq(newKeys.concat(metaDoc.keys));
        kvDocs.splice(0, 0, metaDoc);

        return kvDocs;
      });
    });
}

// updates all emitted key/value docs and metaDocs in the mrview database
// for the given batch of documents from the source database
function saveKeyValues(view, docIdsToEmits, seq) {
  var seqDocId = '_local/lastSeq';
  return view.db.get(seqDocId)[
  "catch"](defaultsTo({_id: seqDocId, seq: 0}))
  .then(function (lastSeqDoc) {
    var docIds = Object.keys(docIdsToEmits);
    return Promise.all(docIds.map(function (docId) {
        return getDocsToPersist(docId, view, docIdsToEmits);
      })).then(function (listOfDocsToPersist) {
        var docsToPersist = [];
        listOfDocsToPersist.forEach(function (docList) {
          docsToPersist = docsToPersist.concat(docList);
        });

        // update the seq doc last, so that if a meteor strikes the user's
        // computer in the middle of an update, we can apply the idempotent
        // batch update operation again
        lastSeqDoc.seq = seq;
        docsToPersist.push(lastSeqDoc);

        return view.db.bulkDocs({docs : docsToPersist});
      });
  });
}

var updateView = utils.sequentialize(mainQueue, function (view) {
  // bind the emit function once
  var mapResults;
  var doc;

  function emit(key, value) {
    var output = { id: doc._id, key: normalizeKey(key) };
    // Don't explicitly store the value unless it's defined and non-null.
    // This saves on storage space, because often people don't use it.
    if (typeof value !== 'undefined' && value !== null) {
      output.value = normalizeKey(value);
    }
    mapResults.push(output);
  }

  var mapFun;
  // for temp_views one can use emit(doc, emit), see #38
  if (typeof view.mapFun === "function" && view.mapFun.length === 2) {
    var origMap = view.mapFun;
    mapFun = function (doc) {
      return origMap(doc, emit);
    };
  } else {
    mapFun = evalFunc(view.mapFun.toString(), emit, sum, log, Array.isArray, JSON.parse);
  }

  var currentSeq = view.seq || 0;

  function processChange(docIdsToEmits, seq) {
    return function () {
      return saveKeyValues(view, docIdsToEmits, seq);
    };
  }
  var queue = new TaskQueue();
  // TODO(neojski): https://github.com/daleharvey/pouchdb/issues/1521

  return new Promise(function (resolve, reject) {

    function complete() {
      queue.finish().then(function () {
        view.seq = currentSeq;
        resolve();
      });
    }

    function processNextBatch() {
      view.sourceDB.changes({
        conflicts: true,
        include_docs: true,
        since : currentSeq,
        limit : CHANGES_BATCH_SIZE
      }).on('complete', function (response) {
        var results = response.results;
        if (!results.length) {
          return complete();
        }
        var docIdsToEmits = {};
        for (var i = 0, l = results.length; i < l; i++) {
          var change = results[i];
          if (change.doc._id[0] !== '_') {
            mapResults = [];
            doc = change.doc;

            if (!doc._deleted) {
              tryCode(view.sourceDB, mapFun, [doc]);
            }
            mapResults.sort(sortByKeyThenValue);

            var indexableKeysToKeyValues = {};
            var lastKey;
            for (var j = 0, jl = mapResults.length; j < jl; j++) {
              var obj = mapResults[j];
              var complexKey = [obj.key, obj.id];
              if (obj.key === lastKey) {
                complexKey.push(j); // dup key+id, so make it unique
              }
              var indexableKey = toIndexableString(complexKey);
              indexableKeysToKeyValues[indexableKey] = obj;
              lastKey = obj.key;
            }
            docIdsToEmits[change.doc._id] = indexableKeysToKeyValues;
          }
          currentSeq = change.seq;
        }
        queue.add(processChange(docIdsToEmits, currentSeq));
        if (results.length < CHANGES_BATCH_SIZE) {
          return complete();
        }
        return processNextBatch();
      }).on('error', onError);
      /* istanbul ignore next */
      function onError(err) {
        reject(err);
      }
    }
    processNextBatch();
  });
});

function reduceView(view, results, options) {
  if (options.group_level === 0) {
    delete options.group_level;
  }

  var shouldGroup = options.group || options.group_level;

  var reduceFun;
  if (builtInReduce[view.reduceFun]) {
    reduceFun = builtInReduce[view.reduceFun];
  } else {
    reduceFun = evalFunc(
      view.reduceFun.toString(), null, sum, log, Array.isArray, JSON.parse);
  }

  var groups = [];
  var lvl = options.group_level;
  results.forEach(function (e) {
    var last = groups[groups.length - 1];
    var key = shouldGroup ? e.key : null;

    // only set group_level for array keys
    if (shouldGroup && Array.isArray(key) && typeof lvl === 'number') {
      key = key.length > lvl ? key.slice(0, lvl) : key;
    }

    if (last && collate(last.key[0][0], key) === 0) {
      last.key.push([key, e.id]);
      last.value.push(e.value);
      return;
    }
    groups.push({key: [
      [key, e.id]
    ], value: [e.value]});
  });
  for (var i = 0, len = groups.length; i < len; i++) {
    var e = groups[i];
    var reduceTry = tryCode(view.sourceDB, reduceFun, [e.key, e.value, false]);
    // CouchDB typically just sets the value to null if reduce errors out
    e.value = reduceTry.error ? null : reduceTry.output;
    e.key = e.key[0][0];
  }
  // no total_rows/offset when reducing
  return {rows: sliceResults(groups, options.limit, options.skip)};
}

var queryView = utils.sequentialize(mainQueue, function (view, opts) {
  var totalRows;
  var shouldReduce = view.reduceFun && opts.reduce !== false;
  var skip = opts.skip || 0;
  if (typeof opts.keys !== 'undefined' && !opts.keys.length) {
    // equivalent query
    opts.limit = 0;
    delete opts.keys;
  }

  function fetchFromView(viewOpts) {
    viewOpts.include_docs = true;
    return view.db.allDocs(viewOpts).then(function (res) {
      totalRows = res.total_rows;
      return res.rows.map(function (result) {

        // implicit migration - in older versions of PouchDB,
        // we explicitly stored the doc as {id: ..., key: ..., value: ...}
        // this is tested in a migration test
        /* istanbul ignore next */
        if ('value' in result.doc && typeof result.doc.value === 'object' &&
            result.doc.value !== null) {
          var keys = Object.keys(result.doc.value).sort();
          // this detection method is not perfect, but it's unlikely the user
          // emitted a value which was an object with these 3 exact keys
          var expectedKeys = ['id', 'key', 'value'];
          if (!(keys < expectedKeys || keys > expectedKeys)) {
            return result.doc.value;
          }
        }

        var parsedKeyAndDocId = pouchCollate.parseIndexableString(result.doc._id);
        return {
          key: parsedKeyAndDocId[0],
          id: parsedKeyAndDocId[1],
          value: ('value' in result.doc ? result.doc.value : null)
        };
      });
    });
  }

  function onMapResultsReady(results) {
    var res;
    if (shouldReduce) {
      res = reduceView(view, results, opts);
    } else {
      res = {
        total_rows: totalRows,
        offset: skip,
        rows: results
      };
    }
    if (opts.include_docs) {
      var getDocsPromises = results.map(function (row) {
        var val = row.value;
        var docId = (val && typeof val === 'object' && val._id) || row.id;
        return view.sourceDB.get(docId, {conflicts: opts.conflicts}).then(function (joinedDoc) {
          row.doc = joinedDoc;
        }, function () {
          // document error = don't join
        });
      });
      return Promise.all(getDocsPromises).then(function () {
        return res;
      });
    } else {
      return res;
    }
  }

  var flatten = function (array) {
    return array.reduce(function (prev, cur) {
      return prev.concat(cur);
    });
  };

  if (typeof opts.keys !== 'undefined') {
    var keys = opts.keys;
    var fetchPromises = keys.map(function (key) {
      var viewOpts = {
        startkey : toIndexableString([key]),
        endkey   : toIndexableString([key, {}])
      };
      return fetchFromView(viewOpts);
    });
    return Promise.all(fetchPromises).then(flatten).then(onMapResultsReady);
  } else { // normal query, no 'keys'
    var viewOpts = {
      descending : opts.descending
    };
    if (typeof opts.startkey !== 'undefined') {
      viewOpts.startkey = opts.descending ?
        toIndexableString([opts.startkey, {}]) :
        toIndexableString([opts.startkey]);
    }
    if (typeof opts.endkey !== 'undefined') {
      var inclusiveEnd = opts.inclusive_end !== false;
      if (opts.descending) {
        inclusiveEnd = !inclusiveEnd;
      }

      viewOpts.endkey = toIndexableString(inclusiveEnd ? [opts.endkey, {}] : [opts.endkey]);
    }
    if (typeof opts.key !== 'undefined') {
      var keyStart = toIndexableString([opts.key]);
      var keyEnd = toIndexableString([opts.key, {}]);
      if (viewOpts.descending) {
        viewOpts.endkey = keyStart;
        viewOpts.startkey = keyEnd;
      } else {
        viewOpts.startkey = keyStart;
        viewOpts.endkey = keyEnd;
      }
    }
    if (!shouldReduce) {
      if (typeof opts.limit === 'number') {
        viewOpts.limit = opts.limit;
      }
      viewOpts.skip = skip;
    }
    return fetchFromView(viewOpts).then(onMapResultsReady);
  }
});

function httpViewCleanup(db) {
  return db.request({
    method: 'POST',
    url: '_view_cleanup'
  });
}

var localViewCleanup = utils.sequentialize(mainQueue, function (db) {
  return db.get('_local/mrviews').then(function (metaDoc) {
    var docsToViews = {};
    Object.keys(metaDoc.views).forEach(function (fullViewName) {
      var parts = parseViewName(fullViewName);
      var designDocName = '_design/' + parts[0];
      var viewName = parts[1];
      docsToViews[designDocName] = docsToViews[designDocName] || {};
      docsToViews[designDocName][viewName] = true;
    });
    var opts = {
      keys : Object.keys(docsToViews),
      include_docs : true
    };
    return db.allDocs(opts).then(function (res) {
      var viewsToStatus = {};
      res.rows.forEach(function (row) {
        var ddocName = row.key.substring(8);
        Object.keys(docsToViews[row.key]).forEach(function (viewName) {
          var fullViewName = ddocName + '/' + viewName;
          /* istanbul ignore if */
          if (!metaDoc.views[fullViewName]) {
            // new format, without slashes, to support PouchDB 2.2.0
            // migration test in pouchdb's browser.migration.js verifies this
            fullViewName = viewName;
          }
          var viewDBNames = Object.keys(metaDoc.views[fullViewName]);
          // design doc deleted, or view function nonexistent
          var statusIsGood = row.doc && row.doc.views && row.doc.views[viewName];
          viewDBNames.forEach(function (viewDBName) {
            viewsToStatus[viewDBName] = viewsToStatus[viewDBName] || statusIsGood;
          });
        });
      });
      var dbsToDelete = Object.keys(viewsToStatus).filter(function (viewDBName) {
        return !viewsToStatus[viewDBName];
      });
      var destroyPromises = dbsToDelete.map(function (viewDBName) {
        return db.constructor.destroy(viewDBName, {adapter : db.adapter});
      });
      return Promise.all(destroyPromises).then(function () {
        return {ok: true};
      });
    });
  }, defaultsTo({ok: true}));
});

exports.viewCleanup = utils.callbackify(function () {
  var db = this;
  if (db.type() === 'http') {
    return httpViewCleanup(db);
  }
  return localViewCleanup(db);
});

function queryPromised(db, fun, opts) {
  if (db.type() === 'http') {
    return httpQuery(db, fun, opts);
  }

  if (typeof fun !== 'string') {
    // temp_view
    checkQueryParseError(opts, fun);

    var createViewOpts = {
      db : db,
      viewName : 'temp_view/temp_view',
      map : fun.map,
      reduce : fun.reduce,
      temporary : true
    };
    tempViewQueue.add(function () {
      return createView(createViewOpts).then(function (view) {
        function cleanup() {
          return view.db.destroy();
        }
        return utils.fin(updateView(view).then(function () {
          return queryView(view, opts);
        }), cleanup);
      });
    });
    return tempViewQueue.finish();
  } else {
    // persistent view
    var fullViewName = fun;
    var parts = parseViewName(fullViewName);
    var designDocName = parts[0];
    var viewName = parts[1];
    return db.get('_design/' + designDocName).then(function (doc) {
      var fun = doc.views && doc.views[viewName];

      if (!fun || typeof fun.map !== 'string') {
        throw new NotFoundError('ddoc ' + designDocName + ' has no view named ' +
          viewName);
      }
      checkQueryParseError(opts, fun);

      var createViewOpts = {
        db : db,
        viewName : fullViewName,
        map : fun.map,
        reduce : fun.reduce
      };
      return createView(createViewOpts).then(function (view) {
        if (opts.stale === 'ok' || opts.stale === 'update_after') {
          if (opts.stale === 'update_after') {
            process.nextTick(function () {
              updateView(view);
            });
          }
          return queryView(view, opts);
        } else { // stale not ok
          return updateView(view).then(function () {
            return queryView(view, opts);
          });
        }
      });
    });
  }
}

exports.query = function (fun, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts = utils.extend(true, {}, opts);

  if (typeof fun === 'function') {
    fun = {map : fun};
  }

  var db = this;
  var promise = Promise.resolve().then(function () {
    return queryPromised(db, fun, opts);
  });
  utils.promisedCallback(promise, callback);
  return promise;
};

function QueryParseError(message) {
  this.status = 400;
  this.name = 'query_parse_error';
  this.message = message;
  this.error = true;
  try {
    Error.captureStackTrace(this, QueryParseError);
  } catch (e) {}
}

utils.inherits(QueryParseError, Error);

function NotFoundError(message) {
  this.status = 404;
  this.name = 'not_found';
  this.message = message;
  this.error = true;
  try {
    Error.captureStackTrace(this, NotFoundError);
  } catch (e) {}
}

utils.inherits(NotFoundError, Error);

}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./create-view":52,"./evalfunc":53,"./taskqueue":57,"./utils":59,"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"pouchdb-collate":55}],55:[function(_dereq_,module,exports){
'use strict';

var MIN_MAGNITUDE = -324; // verified by -Number.MIN_VALUE
var MAGNITUDE_DIGITS = 3; // ditto
var SEP = ''; // set to '_' for easier debugging 

var utils = _dereq_('./utils');

exports.collate = function (a, b) {

  if (a === b) {
    return 0;
  }

  a = exports.normalizeKey(a);
  b = exports.normalizeKey(b);

  var ai = collationIndex(a);
  var bi = collationIndex(b);
  if ((ai - bi) !== 0) {
    return ai - bi;
  }
  if (a === null) {
    return 0;
  }
  switch (typeof a) {
    case 'number':
      return a - b;
    case 'boolean':
      return a === b ? 0 : (a < b ? -1 : 1);
    case 'string':
      return stringCollate(a, b);
  }
  return Array.isArray(a) ? arrayCollate(a, b) : objectCollate(a, b);
};

// couch considers null/NaN/Infinity/-Infinity === undefined,
// for the purposes of mapreduce indexes. also, dates get stringified.
exports.normalizeKey = function (key) {
  switch (typeof key) {
    case 'undefined':
      return null;
    case 'number':
      if (key === Infinity || key === -Infinity || isNaN(key)) {
        return null;
      }
      return key;
    case 'object':
      var origKey = key;
      if (Array.isArray(key)) {
        var len = key.length;
        key = new Array(len);
        for (var i = 0; i < len; i++) {
          key[i] = exports.normalizeKey(origKey[i]);
        }
      } else if (key instanceof Date) {
        return key.toJSON();
      } else if (key !== null) { // generic object
        key = {};
        for (var k in origKey) {
          if (origKey.hasOwnProperty(k)) {
            var val = origKey[k];
            if (typeof val !== 'undefined') {
              key[k] = exports.normalizeKey(val);
            }
          }
        }
      }
  }
  return key;
};

function indexify(key) {
  if (key !== null) {
    switch (typeof key) {
      case 'boolean':
        return key ? 1 : 0;
      case 'number':
        return numToIndexableString(key);
      case 'string':
        // We've to be sure that key does not contain \u0000
        // Do order-preserving replacements:
        // 0 -> 1, 1
        // 1 -> 1, 2
        // 2 -> 2, 2
        return key
          .replace(/\u0002/g, '\u0002\u0002')
          .replace(/\u0001/g, '\u0001\u0002')
          .replace(/\u0000/g, '\u0001\u0001');
      case 'object':
        var isArray = Array.isArray(key);
        var arr = isArray ? key : Object.keys(key);
        var i = -1;
        var len = arr.length;
        var result = '';
        if (isArray) {
          while (++i < len) {
            result += exports.toIndexableString(arr[i]);
          }
        } else {
          while (++i < len) {
            var objKey = arr[i];
            result += exports.toIndexableString(objKey) +
                exports.toIndexableString(key[objKey]);
          }
        }
        return result;
    }
  }
  return '';
}

// convert the given key to a string that would be appropriate
// for lexical sorting, e.g. within a database, where the
// sorting is the same given by the collate() function.
exports.toIndexableString = function (key) {
  var zero = '\u0000';
  key = exports.normalizeKey(key);
  return collationIndex(key) + SEP + indexify(key) + zero;
};

function parseNumber(str, i) {
  var originalIdx = i;
  var num;
  var zero = str[i] === '1';
  if (zero) {
    num = 0;
    i++;
  } else {
    var neg = str[i] === '0';
    i++;
    var numAsString = '';
    var magAsString = str.substring(i, i + MAGNITUDE_DIGITS);
    var magnitude = parseInt(magAsString, 10) + MIN_MAGNITUDE;
    if (neg) {
      magnitude = -magnitude;
    }
    i += MAGNITUDE_DIGITS;
    while (true) {
      var ch = str[i];
      if (ch === '\u0000') {
        break;
      } else {
        numAsString += ch;
      }
      i++;
    }
    numAsString = numAsString.split('.');
    if (numAsString.length === 1) {
      num = parseInt(numAsString, 10);
    } else {
      num = parseFloat(numAsString[0] + '.' + numAsString[1]);
    }
    if (neg) {
      num = num - 10;
    }
    if (magnitude !== 0) {
      // parseFloat is more reliable than pow due to rounding errors
      // e.g. Number.MAX_VALUE would return Infinity if we did
      // num * Math.pow(10, magnitude);
      num = parseFloat(num + 'e' + magnitude);
    }
  }
  return {num: num, length : i - originalIdx};
}

// move up the stack while parsing
// this function moved outside of parseIndexableString for performance
function pop(stack, metaStack) {
  var obj = stack.pop();

  if (metaStack.length) {
    var lastMetaElement = metaStack[metaStack.length - 1];
    if (obj === lastMetaElement.element) {
      // popping a meta-element, e.g. an object whose value is another object
      metaStack.pop();
      lastMetaElement = metaStack[metaStack.length - 1];
    }
    var element = lastMetaElement.element;
    var lastElementIndex = lastMetaElement.index;
    if (Array.isArray(element)) {
      element.push(obj);
    } else if (lastElementIndex === stack.length - 2) { // obj with key+value
      var key = stack.pop();
      element[key] = obj;
    } else {
      stack.push(obj); // obj with key only
    }
  }
}

exports.parseIndexableString = function (str) {
  var stack = [];
  var metaStack = []; // stack for arrays and objects
  var i = 0;

  while (true) {
    var collationIndex = str[i++];
    if (collationIndex === '\u0000') {
      if (stack.length === 1) {
        return stack.pop();
      } else {
        pop(stack, metaStack);
        continue;
      }
    }
    switch (collationIndex) {
      case '1':
        stack.push(null);
        break;
      case '2':
        stack.push(str[i] === '1');
        i++;
        break;
      case '3':
        var parsedNum = parseNumber(str, i);
        stack.push(parsedNum.num);
        i += parsedNum.length;
        break;
      case '4':
        var parsedStr = '';
        while (true) {
          var ch = str[i];
          if (ch === '\u0000') {
            break;
          }
          parsedStr += ch;
          i++;
        }
        // perform the reverse of the order-preserving replacement
        // algorithm (see above)
        parsedStr = parsedStr.replace(/\u0001\u0001/g, '\u0000')
          .replace(/\u0001\u0002/g, '\u0001')
          .replace(/\u0002\u0002/g, '\u0002');
        stack.push(parsedStr);
        break;
      case '5':
        var arrayElement = { element: [], index: stack.length };
        stack.push(arrayElement.element);
        metaStack.push(arrayElement);
        break;
      case '6':
        var objElement = { element: {}, index: stack.length };
        stack.push(objElement.element);
        metaStack.push(objElement);
        break;
      default:
        throw new Error(
          'bad collationIndex or unexpectedly reached end of input: ' + collationIndex);
    }
  }
};

function arrayCollate(a, b) {
  var len = Math.min(a.length, b.length);
  for (var i = 0; i < len; i++) {
    var sort = exports.collate(a[i], b[i]);
    if (sort !== 0) {
      return sort;
    }
  }
  return (a.length === b.length) ? 0 :
    (a.length > b.length) ? 1 : -1;
}
function stringCollate(a, b) {
  // See: https://github.com/daleharvey/pouchdb/issues/40
  // This is incompatible with the CouchDB implementation, but its the
  // best we can do for now
  return (a === b) ? 0 : ((a > b) ? 1 : -1);
}
function objectCollate(a, b) {
  var ak = Object.keys(a), bk = Object.keys(b);
  var len = Math.min(ak.length, bk.length);
  for (var i = 0; i < len; i++) {
    // First sort the keys
    var sort = exports.collate(ak[i], bk[i]);
    if (sort !== 0) {
      return sort;
    }
    // if the keys are equal sort the values
    sort = exports.collate(a[ak[i]], b[bk[i]]);
    if (sort !== 0) {
      return sort;
    }

  }
  return (ak.length === bk.length) ? 0 :
    (ak.length > bk.length) ? 1 : -1;
}
// The collation is defined by erlangs ordered terms
// the atoms null, true, false come first, then numbers, strings,
// arrays, then objects
// null/undefined/NaN/Infinity/-Infinity are all considered null
function collationIndex(x) {
  var id = ['boolean', 'number', 'string', 'object'];
  var idx = id.indexOf(typeof x);
  //false if -1 otherwise true, but fast!!!!1
  if (~idx) {
    if (x === null) {
      return 1;
    }
    if (Array.isArray(x)) {
      return 5;
    }
    return idx < 3 ? (idx + 2) : (idx + 3);
  }
  if (Array.isArray(x)) {
    return 5;
  }
}

// conversion:
// x yyy zz...zz
// x = 0 for negative, 1 for 0, 2 for positive
// y = exponent (for negative numbers negated) moved so that it's >= 0
// z = mantisse
function numToIndexableString(num) {

  if (num === 0) {
    return '1';
  }

  // convert number to exponential format for easier and
  // more succinct string sorting
  var expFormat = num.toExponential().split(/e\+?/);
  var magnitude = parseInt(expFormat[1], 10);

  var neg = num < 0;

  var result = neg ? '0' : '2';

  // first sort by magnitude
  // it's easier if all magnitudes are positive
  var magForComparison = ((neg ? -magnitude : magnitude) - MIN_MAGNITUDE);
  var magString = utils.padLeft((magForComparison).toString(), '0', MAGNITUDE_DIGITS);

  result += SEP + magString;

  // then sort by the factor
  var factor = Math.abs(parseFloat(expFormat[0])); // [1..10)
  if (neg) { // for negative reverse ordering
    factor = 10 - factor;
  }

  var factorStr = factor.toFixed(20);

  // strip zeros from the end
  factorStr = factorStr.replace(/\.?0+$/, '');

  result += SEP + factorStr;

  return result;
}

},{"./utils":56}],56:[function(_dereq_,module,exports){
'use strict';

function pad(str, padWith, upToLength) {
  var padding = '';
  var targetLength = upToLength - str.length;
  while (padding.length < targetLength) {
    padding += padWith;
  }
  return padding;
}

exports.padLeft = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return padding + str;
};

exports.padRight = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return str + padding;
};

exports.stringLexCompare = function (a, b) {

  var aLen = a.length;
  var bLen = b.length;

  var i;
  for (i = 0; i < aLen; i++) {
    if (i === bLen) {
      // b is shorter substring of a
      return 1;
    }
    var aChar = a.charAt(i);
    var bChar = b.charAt(i);
    if (aChar !== bChar) {
      return aChar < bChar ? -1 : 1;
    }
  }

  if (aLen < bLen) {
    // a is shorter substring of b
    return -1;
  }

  return 0;
};

/*
 * returns the decimal form for the given integer, i.e. writes
 * out all the digits (in base-10) instead of using scientific notation
 */
exports.intToDecimalForm = function (int) {

  var isNeg = int < 0;
  var result = '';

  do {
    var remainder = isNeg ? -Math.ceil(int % 10) : Math.floor(int % 10);

    result = remainder + result;
    int = isNeg ? Math.ceil(int / 10) : Math.floor(int / 10);
  } while (int);


  if (isNeg && result !== '0') {
    result = '-' + result;
  }

  return result;
};
},{}],57:[function(_dereq_,module,exports){
'use strict';
/*
 * Simple task queue to sequentialize actions. Assumes callbacks will eventually fire (once).
 */

var Promise = _dereq_('./utils').Promise;

function TaskQueue() {
  this.promise = new Promise(function (fulfill) {fulfill(); });
}
TaskQueue.prototype.add = function (promiseFactory) {
  this.promise = this.promise["catch"](function () {
    // just recover
  }).then(function () {
    return promiseFactory();
  });
  return this.promise;
};
TaskQueue.prototype.finish = function () {
  return this.promise;
};

module.exports = TaskQueue;

},{"./utils":59}],58:[function(_dereq_,module,exports){
'use strict';
var Promise = _dereq_('./utils').Promise;

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
// the diffFun tells us what delta to apply to the doc.  it either returns
// the doc, or false if it doesn't need to do an update after all
function upsert(db, docId, diffFun) {
  return new Promise(function (fulfill, reject) {
    if (docId && typeof docId === 'object') {
      docId = docId._id;
    }
    if (typeof docId !== 'string') {
      return reject(new Error('doc id is required'));
    }

    db.get(docId, function (err, doc) {
      if (err) {
        if (err.status !== 404) {
          return reject(err);
        }
        return fulfill(tryAndPut(db, diffFun({_id : docId}), diffFun));
      }
      var newDoc = diffFun(doc);
      if (!newDoc) {
        return fulfill(doc);
      }
      fulfill(tryAndPut(db, newDoc, diffFun));
    });
  });
}

function tryAndPut(db, doc, diffFun) {
  return db.put(doc)["catch"](function (err) {
    if (err.status !== 409) {
      throw err;
    }
    return upsert(db, doc, diffFun);
  });
}

module.exports = upsert;

},{"./utils":59}],59:[function(_dereq_,module,exports){
(function (process,global){
'use strict';
/* istanbul ignore if */
if (typeof global.Promise === 'function') {
  exports.Promise = global.Promise;
} else {
  exports.Promise = _dereq_('lie');
}
// uniquify a list, similar to underscore's _.uniq
exports.uniq = function (arr) {
  var map = {};
  arr.forEach(function (element) {
    map[element] = true;
  });
  return Object.keys(map);
};

exports.inherits = _dereq_('inherits');
exports.extend = _dereq_('pouchdb-extend');
var argsarray = _dereq_('argsarray');

exports.promisedCallback = function (promise, callback) {
  if (callback) {
    promise.then(function (res) {
      process.nextTick(function () {
        callback(null, res);
      });
    }, function (reason) {
      process.nextTick(function () {
        callback(reason);
      });
    });
  }
  return promise;
};

exports.callbackify = function (fun) {
  return argsarray(function (args) {
    var cb = args.pop();
    var promise = fun.apply(this, args);
    if (typeof cb === 'function') {
      exports.promisedCallback(promise, cb);
    }
    return promise;
  });
};

// Promise finally util similar to Q.finally
exports.fin = function (promise, cb) {
  return promise.then(function (res) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        return res;
      });
    }
    return res;
  }, function (reason) {
    var promise2 = cb();
    if (typeof promise2.then === 'function') {
      return promise2.then(function () {
        throw reason;
      });
    }
    throw reason;
  });
};

exports.sequentialize = function (queue, promiseFactory) {
  return function () {
    var args = arguments;
    var that = this;
    return queue.add(function () {
      return promiseFactory.apply(that, args);
    });
  };
};

var crypto = _dereq_('crypto');
var Md5 = _dereq_('spark-md5');

exports.MD5 = function (string) {
  /* istanbul ignore else */
  if (!process.browser) {
    return crypto.createHash('md5').update(string).digest('hex');
  } else {
    return Md5.hash(string);
  }
};
}).call(this,_dereq_("/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/Users/daleharvey/src/pouchdb/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":31,"argsarray":28,"crypto":29,"inherits":32,"lie":36,"pouchdb-extend":51,"spark-md5":60}],60:[function(_dereq_,module,exports){
/*jshint bitwise:false*/
/*global unescape*/

(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else {
        // Browser globals (with support for web workers)
        var glob;
        try {
            glob = window;
        } catch (e) {
            glob = self;
        }

        glob.SparkMD5 = factory();
    }
}(function (undefined) {

    'use strict';

    ////////////////////////////////////////////////////////////////////////////

    /*
     * Fastest md5 implementation around (JKM md5)
     * Credits: Joseph Myers
     *
     * @see http://www.myersdaily.org/joseph/javascript/md5-text.html
     * @see http://jsperf.com/md5-shootout/7
     */

    /* this function is much faster,
      so if possible we use it. Some IEs
      are the only ones I know of that
      need the idiotic second function,
      generated by an if clause.  */
    var add32 = function (a, b) {
        return (a + b) & 0xFFFFFFFF;
    },

    cmn = function (q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    },

    ff = function (a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    },

    gg = function (a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    },

    hh = function (a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    },

    ii = function (a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    },

    md5cycle = function (x, k) {
        var a = x[0],
            b = x[1],
            c = x[2],
            d = x[3];

        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
    },

    /* there needs to be support for Unicode here,
       * unless we pretend that we can redefine the MD-5
       * algorithm for multi-byte characters (perhaps
       * by adding every four 16-bit characters and
       * shortening the sum to 32 bits). Otherwise
       * I suggest performing MD-5 as if every character
       * was two bytes--e.g., 0040 0025 = @%--but then
       * how will an ordinary MD-5 sum be matched?
       * There is no way to standardize text to something
       * like UTF-8 before transformation; speed cost is
       * utterly prohibitive. The JavaScript standard
       * itself needs to look at this: it should start
       * providing access to strings as preformed UTF-8
       * 8-bit unsigned value arrays.
       */
    md5blk = function (s) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    },

    md5blk_array = function (a) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = a[i] + (a[i + 1] << 8) + (a[i + 2] << 16) + (a[i + 3] << 24);
        }
        return md5blks;
    },

    md51 = function (s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        length = s.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        }
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);
        return state;
    },

    md51_array = function (a) {
        var n = a.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk_array(a.subarray(i - 64, i)));
        }

        // Not sure if it is a bug, however IE10 will always produce a sub array of length 1
        // containing the last element of the parent array if the sub array specified starts
        // beyond the length of the parent array - weird.
        // https://connect.microsoft.com/IE/feedback/details/771452/typed-array-subarray-issue
        a = (i - 64) < n ? a.subarray(i - 64) : new Uint8Array(0);

        length = a.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= a[i] << ((i % 4) << 3);
        }

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);

        return state;
    },

    hex_chr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'],

    rhex = function (n) {
        var s = '',
            j;
        for (j = 0; j < 4; j += 1) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
    },

    hex = function (x) {
        var i;
        for (i = 0; i < x.length; i += 1) {
            x[i] = rhex(x[i]);
        }
        return x.join('');
    },

    md5 = function (s) {
        return hex(md51(s));
    },



    ////////////////////////////////////////////////////////////////////////////

    /**
     * SparkMD5 OOP implementation.
     *
     * Use this class to perform an incremental md5, otherwise use the
     * static methods instead.
     */
    SparkMD5 = function () {
        // call reset to init the instance
        this.reset();
    };


    // In some cases the fast add32 function cannot be used..
    if (md5('hello') !== '5d41402abc4b2a76b9719d911017c592') {
        add32 = function (x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF),
                msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        };
    }


    /**
     * Appends a string.
     * A conversion will be applied if an utf8 string is detected.
     *
     * @param {String} str The string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.append = function (str) {
        // converts the string to utf8 bytes if necessary
        if (/[\u0080-\uFFFF]/.test(str)) {
            str = unescape(encodeURIComponent(str));
        }

        // then append as binary
        this.appendBinary(str);

        return this;
    };

    /**
     * Appends a binary string.
     *
     * @param {String} contents The binary string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.appendBinary = function (contents) {
        this._buff += contents;
        this._length += contents.length;

        var length = this._buff.length,
            i;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._state, md5blk(this._buff.substring(i - 64, i)));
        }

        this._buff = this._buff.substr(i - 64);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     * Use the raw parameter to obtain the raw result instead of the hex one.
     *
     * @param {Boolean} raw True to get the raw result, false to get the hex result
     *
     * @return {String|Array} The result
     */
    SparkMD5.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            i,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff.charCodeAt(i) << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = !!raw ? this._state : hex(this._state);

        this.reset();

        return ret;
    };

    /**
     * Finish the final calculation based on the tail.
     *
     * @param {Array}  tail   The tail (will be modified)
     * @param {Number} length The length of the remaining buffer
     */
    SparkMD5.prototype._finish = function (tail, length) {
        var i = length,
            tmp,
            lo,
            hi;

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(this._state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Do the final computation based on the tail and length
        // Beware that the final length may not fit in 32 bits so we take care of that
        tmp = this._length * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;
        md5cycle(this._state, tail);
    };

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.reset = function () {
        this._buff = "";
        this._length = 0;
        this._state = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Releases memory used by the incremental buffer and other aditional
     * resources. If you plan to use the instance again, use reset instead.
     */
    SparkMD5.prototype.destroy = function () {
        delete this._state;
        delete this._buff;
        delete this._length;
    };


    /**
     * Performs the md5 hash on a string.
     * A conversion will be applied if utf8 string is detected.
     *
     * @param {String}  str The string
     * @param {Boolean} raw True to get the raw result, false to get the hex result
     *
     * @return {String|Array} The result
     */
    SparkMD5.hash = function (str, raw) {
        // converts the string to utf8 bytes if necessary
        if (/[\u0080-\uFFFF]/.test(str)) {
            str = unescape(encodeURIComponent(str));
        }

        var hash = md51(str);

        return !!raw ? hash : hex(hash);
    };

    /**
     * Performs the md5 hash on a binary string.
     *
     * @param {String}  content The binary string
     * @param {Boolean} raw     True to get the raw result, false to get the hex result
     *
     * @return {String|Array} The result
     */
    SparkMD5.hashBinary = function (content, raw) {
        var hash = md51(content);

        return !!raw ? hash : hex(hash);
    };

    /**
     * SparkMD5 OOP implementation for array buffers.
     *
     * Use this class to perform an incremental md5 ONLY for array buffers.
     */
    SparkMD5.ArrayBuffer = function () {
        // call reset to init the instance
        this.reset();
    };

    ////////////////////////////////////////////////////////////////////////////

    /**
     * Appends an array buffer.
     *
     * @param {ArrayBuffer} arr The array to be appended
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.append = function (arr) {
        // TODO: we could avoid the concatenation here but the algorithm would be more complex
        //       if you find yourself needing extra performance, please make a PR.
        var buff = this._concatArrayBuffer(this._buff, arr),
            length = buff.length,
            i;

        this._length += arr.byteLength;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._state, md5blk_array(buff.subarray(i - 64, i)));
        }

        // Avoids IE10 weirdness (documented above)
        this._buff = (i - 64) < length ? buff.subarray(i - 64) : new Uint8Array(0);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     * Use the raw parameter to obtain the raw result instead of the hex one.
     *
     * @param {Boolean} raw True to get the raw result, false to get the hex result
     *
     * @return {String|Array} The result
     */
    SparkMD5.ArrayBuffer.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            i,
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff[i] << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = !!raw ? this._state : hex(this._state);

        this.reset();

        return ret;
    };

    SparkMD5.ArrayBuffer.prototype._finish = SparkMD5.prototype._finish;

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.reset = function () {
        this._buff = new Uint8Array(0);
        this._length = 0;
        this._state = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Releases memory used by the incremental buffer and other aditional
     * resources. If you plan to use the instance again, use reset instead.
     */
    SparkMD5.ArrayBuffer.prototype.destroy = SparkMD5.prototype.destroy;

    /**
     * Concats two array buffers, returning a new one.
     *
     * @param  {ArrayBuffer} first  The first array buffer
     * @param  {ArrayBuffer} second The second array buffer
     *
     * @return {ArrayBuffer} The new array buffer
     */
    SparkMD5.ArrayBuffer.prototype._concatArrayBuffer = function (first, second) {
        var firstLength = first.length,
            result = new Uint8Array(firstLength + second.byteLength);

        result.set(first);
        result.set(new Uint8Array(second), firstLength);

        return result;
    };

    /**
     * Performs the md5 hash on an array buffer.
     *
     * @param {ArrayBuffer} arr The array buffer
     * @param {Boolean}     raw True to get the raw result, false to get the hex result
     *
     * @return {String|Array} The result
     */
    SparkMD5.ArrayBuffer.hash = function (arr, raw) {
        var hash = md51_array(new Uint8Array(arr));

        return !!raw ? hash : hex(hash);
    };

    return SparkMD5;
}));

},{}],61:[function(_dereq_,module,exports){
'use strict';

/**
 * Stringify/parse functions that don't operate
 * recursively, so they avoid call stack exceeded
 * errors.
 */
exports.stringify = function stringify(input) {
  var queue = [];
  queue.push({obj: input});

  var res = '';
  var next, obj, prefix, val, i, arrayPrefix, keys, k, key, value, objPrefix;
  while ((next = queue.pop())) {
    obj = next.obj;
    prefix = next.prefix || '';
    val = next.val || '';
    res += prefix;
    if (val) {
      res += val;
    } else if (typeof obj !== 'object') {
      res += typeof obj === 'undefined' ? null : JSON.stringify(obj);
    } else if (obj === null) {
      res += 'null';
    } else if (Array.isArray(obj)) {
      queue.push({val: ']'});
      for (i = obj.length - 1; i >= 0; i--) {
        arrayPrefix = i === 0 ? '' : ',';
        queue.push({obj: obj[i], prefix: arrayPrefix});
      }
      queue.push({val: '['});
    } else { // object
      keys = [];
      for (k in obj) {
        if (obj.hasOwnProperty(k)) {
          keys.push(k);
        }
      }
      queue.push({val: '}'});
      for (i = keys.length - 1; i >= 0; i--) {
        key = keys[i];
        value = obj[key];
        objPrefix = (i > 0 ? ',' : '');
        objPrefix += JSON.stringify(key) + ':';
        queue.push({obj: value, prefix: objPrefix});
      }
      queue.push({val: '{'});
    }
  }
  return res;
};

// Convenience function for the parse function.
// This pop function is basically copied from
// pouchCollate.parseIndexableString
function pop(obj, stack, metaStack) {
  var lastMetaElement = metaStack[metaStack.length - 1];
  if (obj === lastMetaElement.element) {
    // popping a meta-element, e.g. an object whose value is another object
    metaStack.pop();
    lastMetaElement = metaStack[metaStack.length - 1];
  }
  var element = lastMetaElement.element;
  var lastElementIndex = lastMetaElement.index;
  if (Array.isArray(element)) {
    element.push(obj);
  } else if (lastElementIndex === stack.length - 2) { // obj with key+value
    var key = stack.pop();
    element[key] = obj;
  } else {
    stack.push(obj); // obj with key only
  }
}

exports.parse = function (str) {
  var stack = [];
  var metaStack = []; // stack for arrays and objects
  var i = 0;
  var collationIndex,parsedNum,numChar;
  var parsedString,lastCh,numConsecutiveSlashes,ch;
  var arrayElement, objElement;
  while (true) {
    collationIndex = str[i++];
    if (collationIndex === '}' ||
        collationIndex === ']' ||
        typeof collationIndex === 'undefined') {
      if (stack.length === 1) {
        return stack.pop();
      } else {
        pop(stack.pop(), stack, metaStack);
        continue;
      }
    }
    switch (collationIndex) {
      case ' ':
      case '\t':
      case '\n':
      case ':':
      case ',':
        break;
      case 'n':
        i += 3; // 'ull'
        pop(null, stack, metaStack);
        break;
      case 't':
        i += 3; // 'rue'
        pop(true, stack, metaStack);
        break;
      case 'f':
        i += 4; // 'alse'
        pop(false, stack, metaStack);
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '-':
        parsedNum = '';
        i--;
        while (true) {
          numChar = str[i++];
          if (/[\d\.\-e\+]/.test(numChar)) {
            parsedNum += numChar;
          } else {
            i--;
            break;
          }
        }
        pop(parseFloat(parsedNum), stack, metaStack);
        break;
      case '"':
        parsedString = '';
        lastCh = void 0;
        numConsecutiveSlashes = 0;
        while (true) {
          ch = str[i++];
          if (ch !== '"' || (lastCh === '\\' &&
              numConsecutiveSlashes % 2 === 1)) {
            parsedString += ch;
            lastCh = ch;
            if (lastCh === '\\') {
              numConsecutiveSlashes++;
            } else {
              numConsecutiveSlashes = 0;
            }
          } else {
            break;
          }
        }
        pop(JSON.parse('"' + parsedString + '"'), stack, metaStack);
        break;
      case '[':
        arrayElement = { element: [], index: stack.length };
        stack.push(arrayElement.element);
        metaStack.push(arrayElement);
        break;
      case '{':
        objElement = { element: {}, index: stack.length };
        stack.push(objElement.element);
        metaStack.push(objElement);
        break;
      default:
        throw new Error(
          'unexpectedly reached end of input: ' + collationIndex);
    }
  }
};

},{}]},{},[20])
(20)
});
}, {}],
9: [function(require, module, exports) {

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

}, {}],
10: [function(require, module, exports) {
/**
 * Export `uid`
 */

module.exports = uid;

/**
 * Create a `uid`
 *
 * @param {String} len
 * @return {String} uid
 */

function uid(len) {
  len = len || 7;
  return Math.random().toString(35).substr(2, len);
}

}, {}],
11: [function(require, module, exports) {
'use strict';
var Emitter = require('component/emitter');
var uid = require('matthewmueller/uid');
var Todo;

/**
 * Initialize `Todo` with `attrs`
 * @param {Object} attrs
 */
Todo = function Todo(attrs) {
    if (!(this instanceof Todo)) return new Todo(attrs);
    attrs = attrs || {};
    this._id = attrs._id || uid();
    this.complete = attrs.complete || false;
    this.title = attrs.title || '';
    this.timestamp = new Date().getTime();
};

/**
 * Mixins
 */
Emitter(Todo.prototype);

/**
 * Retrieve the attributes of a todo
 * @return {Object} attributes
 */
Todo.prototype.attrs = function attrs() {
    var props = {};
    if (this._id) props._id = this._id;
    if (this._rev !== -1) props._rev = this._rev;
    props.complete = this.complete;
    props.title = this.title;
    return props;
};

Todo.prototype.set = function set(attrs) {
    for (var key in attrs) {
        this[key] = attrs[key];
        this.emit('change');
        this.emit('change ' + key, this[key]);
    };
};

Todo.prototype.get = function get(attr) {
    return this[attr];
};

module.exports = Todo;
}, {"component/emitter":9,"matthewmueller/uid":10}],
5: [function(require, module, exports) {
'use strict';
var Emitter = require('component/emitter');
var month = require('anthonyshort/date-month');
var suffixed = require('anthonyshort/date-suffix');
var move = require('visionmedia/move.js');
var domify = require('component/domify');
var template = require('./template.html');
var TodoView = require('./lib/todo-view');
var ListView;

/**
 * Initialize `ListView` with `model`
 * @param {List} model
 */
ListView = function ListView(model) {
    if (!(this instanceof ListView)) return new ListView(model);
    model = model || {};
    var self = this;
    this.model = model;
    this.el = domify(template);
    this.listEl = this.el.querySelector('.List-todos');
    this.todoViews = [];
    this.createTitle();

    this.model.todos.forEach(function (todo) {
        self.createTodo(todo);
    });

    this.model.on('create todo', function (todo) {
        self.createTodo(todo);
    });
};

/**
 * Mixins
 */
Emitter(ListView.prototype);

/**
 * Create title element
 * @api private
 */
ListView.prototype.createTitle = function createTitle() {
    var titleEl = this.el.querySelector('.List-title');
    var titleMonth = month(this.model.timestamp).full();
    var titleSuffixed =  suffixed(this.model.timestamp);
    titleEl.innerHTML = titleMonth + ' ' + titleSuffixed;
};

/**
 * Create a new todo element with `todo` model
 * and animate it
 * @param  {Todo} todo
 * @api private
 */
ListView.prototype.createTodo = function createTodo(todo) {
    var view = TodoView(todo);
    this.todoViews.push(view);
    this.listEl.appendChild(view.el);
    view.el.style.display = 'none';
    view.el.style.display = 'block';
    move(view.el).y(1000).end();
    move(view.el).y(0).end();
};

/**
 * Hide/show the todo elements by `todo` model properties
 * @param  {String} key model property name
 * @param  {Mixed} val model property value
 * @api public
 */
ListView.prototype.filter = function filter(key, val) {
    this.todoViews.forEach(function (view) {
        if (view.model[key] === val) return view.show();
        view.hide();
    });
};

module.exports = ListView;
}, {"component/emitter":9,"anthonyshort/date-month":12,"anthonyshort/date-suffix":13,"visionmedia/move.js":14,"component/domify":15,"./template.html":16,"./lib/todo-view":17}],
12: [function(require, module, exports) {
var months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

var short = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

var double = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12'
];

var single = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12'
];

module.exports = function(date) {
  var month = date.getMonth();
  return {
    full: function(){
      return months[month];
    },
    short: function(){
      return short[month];
    },
    double: function(){
      return double[month];
    },
    single: function(){
      return single[month];
    }
  };
};
}, {}],
13: [function(require, module, exports) {
module.exports = function(date) {
  var num = date.getDate();
  if ( num % 100 >= 10 && num % 100 <= 19 ) {
    return num + 'th';
  }
  switch ( num % 10 ) {
    case 1: return num + 'st';
    case 2: return num + 'nd';
    case 3: return num + 'rd';
  }
  return num + 'th';
};
}, {}],
14: [function(require, module, exports) {
/**
 * Module Dependencies.
 */

var after = require('after-transition');
var has3d = require('has-translate3d');
var Emitter = require('emitter');
var ease = require('css-ease');
var query = require('query');

/**
 * CSS Translate
 */

var translate = has3d
  ? ['translate3d(', ', 0)']
  : ['translate(', ')'];

/**
 * Export `Move`
 */

module.exports = Move;

/**
 * Get computed style.
 */

var style = window.getComputedStyle
  || window.currentStyle;

/**
 * Library version.
 */

Move.version = '0.3.2';

/**
 * Export `ease`
 */

Move.ease = ease;

/**
 * Defaults.
 *
 *   `duration` - default duration of 500ms
 *
 */

Move.defaults = {
  duration: 500
};

/**
 * Default element selection utilized by `move(selector)`.
 *
 * Override to implement your own selection, for example
 * with jQuery one might write:
 *
 *     move.select = function(selector) {
 *       return jQuery(selector).get(0);
 *     };
 *
 * @param {Object|String} selector
 * @return {Element}
 * @api public
 */

Move.select = function(selector){
  if ('string' != typeof selector) return selector;
  return query(selector);
};

/**
 * Initialize a new `Move` with the given `el`.
 *
 * @param {Element} el
 * @api public
 */

function Move(el) {
  if (!(this instanceof Move)) return new Move(el);
  if ('string' == typeof el) el = query(el);
  if (!el) throw new TypeError('Move must be initialized with element or selector');
  this.el = el;
  this._props = {};
  this._rotate = 0;
  this._transitionProps = [];
  this._transforms = [];
  this.duration(Move.defaults.duration)
};


/**
 * Inherit from `EventEmitter.prototype`.
 */

Emitter(Move.prototype);

/**
 * Buffer `transform`.
 *
 * @param {String} transform
 * @return {Move} for chaining
 * @api private
 */

Move.prototype.transform = function(transform){
  this._transforms.push(transform);
  return this;
};

/**
 * Skew `x` and `y`.
 *
 * @param {Number} x
 * @param {Number} y
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.skew = function(x, y){
  return this.transform('skew('
    + x + 'deg, '
    + (y || 0)
    + 'deg)');
};

/**
 * Skew x by `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.skewX = function(n){
  return this.transform('skewX(' + n + 'deg)');
};

/**
 * Skew y by `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.skewY = function(n){
  return this.transform('skewY(' + n + 'deg)');
};

/**
 * Translate `x` and `y` axis.
 *
 * @param {Number} x
 * @param {Number} y
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.translate =
Move.prototype.to = function(x, y){
  return this.transform(translate.join(''
    + x +'px, '
    + (y || 0)
    + 'px'));
};

/**
 * Translate on the x axis to `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.translateX =
Move.prototype.x = function(n){
  return this.transform('translateX(' + n + 'px)');
};

/**
 * Translate on the y axis to `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.translateY =
Move.prototype.y = function(n){
  return this.transform('translateY(' + n + 'px)');
};

/**
 * Scale the x and y axis by `x`, or
 * individually scale `x` and `y`.
 *
 * @param {Number} x
 * @param {Number} y
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.scale = function(x, y){
  return this.transform('scale('
    + x + ', '
    + (y || x)
    + ')');
};

/**
 * Scale x axis by `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.scaleX = function(n){
  return this.transform('scaleX(' + n + ')')
};

/**
 * Apply a matrix transformation
 *
 * @param {Number} m11 A matrix coefficient
 * @param {Number} m12 A matrix coefficient
 * @param {Number} m21 A matrix coefficient
 * @param {Number} m22 A matrix coefficient
 * @param {Number} m31 A matrix coefficient
 * @param {Number} m32 A matrix coefficient
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.matrix = function(m11, m12, m21, m22, m31, m32){
  return this.transform('matrix(' + [m11,m12,m21,m22,m31,m32].join(',') + ')');
};

/**
 * Scale y axis by `n`.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.scaleY = function(n){
  return this.transform('scaleY(' + n + ')')
};

/**
 * Rotate `n` degrees.
 *
 * @param {Number} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.rotate = function(n){
  return this.transform('rotate(' + n + 'deg)');
};

/**
 * Set transition easing function to to `fn` string.
 *
 * When:
 *
 *   - null "ease" is used
 *   - "in" "ease-in" is used
 *   - "out" "ease-out" is used
 *   - "in-out" "ease-in-out" is used
 *
 * @param {String} fn
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.ease = function(fn){
  fn = ease[fn] || fn || 'ease';
  return this.setVendorProperty('transition-timing-function', fn);
};

/**
 * Set animation properties
 *
 * @param {String} name
 * @param {Object} props
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.animate = function(name, props){
  for (var i in props){
    if (props.hasOwnProperty(i)){
      this.setVendorProperty('animation-' + i, props[i])
    }
  }
  return this.setVendorProperty('animation-name', name);
}

/**
 * Set duration to `n`.
 *
 * @param {Number|String} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.duration = function(n){
  n = this._duration = 'string' == typeof n
    ? parseFloat(n) * 1000
    : n;
  return this.setVendorProperty('transition-duration', n + 'ms');
};

/**
 * Delay the animation by `n`.
 *
 * @param {Number|String} n
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.delay = function(n){
  n = 'string' == typeof n
    ? parseFloat(n) * 1000
    : n;
  return this.setVendorProperty('transition-delay', n + 'ms');
};

/**
 * Set `prop` to `val`, deferred until `.end()` is invoked.
 *
 * @param {String} prop
 * @param {String} val
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.setProperty = function(prop, val){
  this._props[prop] = val;
  return this;
};

/**
 * Set a vendor prefixed `prop` with the given `val`.
 *
 * @param {String} prop
 * @param {String} val
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.setVendorProperty = function(prop, val){
  this.setProperty('-webkit-' + prop, val);
  this.setProperty('-moz-' + prop, val);
  this.setProperty('-ms-' + prop, val);
  this.setProperty('-o-' + prop, val);
  return this;
};

/**
 * Set `prop` to `value`, deferred until `.end()` is invoked
 * and adds the property to the list of transition props.
 *
 * @param {String} prop
 * @param {String} val
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.set = function(prop, val){
  this.transition(prop);
  this._props[prop] = val;
  return this;
};

/**
 * Increment `prop` by `val`, deferred until `.end()` is invoked
 * and adds the property to the list of transition props.
 *
 * @param {String} prop
 * @param {Number} val
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.add = function(prop, val){
  if (!style) return;
  var self = this;
  return this.on('start', function(){
    var curr = parseInt(self.current(prop), 10);
    self.set(prop, curr + val + 'px');
  });
};

/**
 * Decrement `prop` by `val`, deferred until `.end()` is invoked
 * and adds the property to the list of transition props.
 *
 * @param {String} prop
 * @param {Number} val
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.sub = function(prop, val){
  if (!style) return;
  var self = this;
  return this.on('start', function(){
    var curr = parseInt(self.current(prop), 10);
    self.set(prop, curr - val + 'px');
  });
};

/**
 * Get computed or "current" value of `prop`.
 *
 * @param {String} prop
 * @return {String}
 * @api public
 */

Move.prototype.current = function(prop){
  return style(this.el).getPropertyValue(prop);
};

/**
 * Add `prop` to the list of internal transition properties.
 *
 * @param {String} prop
 * @return {Move} for chaining
 * @api private
 */

Move.prototype.transition = function(prop){
  if (!this._transitionProps.indexOf(prop)) return this;
  this._transitionProps.push(prop);
  return this;
};

/**
 * Commit style properties, aka apply them to `el.style`.
 *
 * @return {Move} for chaining
 * @see Move#end()
 * @api private
 */

Move.prototype.applyProperties = function(){
  for (var prop in this._props) {
    this.el.style.setProperty(prop, this._props[prop], '');
  }
  return this;
};

/**
 * Re-select element via `selector`, replacing
 * the current element.
 *
 * @param {String} selector
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.move =
Move.prototype.select = function(selector){
  this.el = Move.select(selector);
  return this;
};

/**
 * Defer the given `fn` until the animation
 * is complete. `fn` may be one of the following:
 *
 *   - a function to invoke
 *   - an instanceof `Move` to call `.end()`
 *   - nothing, to return a clone of this `Move` instance for chaining
 *
 * @param {Function|Move} fn
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.then = function(fn){
  // invoke .end()
  if (fn instanceof Move) {
    this.on('end', function(){
      fn.end();
    });
  // callback
  } else if ('function' == typeof fn) {
    this.on('end', fn);
  // chain
  } else {
    var clone = new Move(this.el);
    clone._transforms = this._transforms.slice(0);
    this.then(clone);
    clone.parent = this;
    return clone;
  }

  return this;
};

/**
 * Pop the move context.
 *
 * @return {Move} parent Move
 * @api public
 */

Move.prototype.pop = function(){
  return this.parent;
};

/**
 * Reset duration.
 *
 * @return {Move}
 * @api public
 */

Move.prototype.reset = function(){
  this.el.style.webkitTransitionDuration =
  this.el.style.mozTransitionDuration =
  this.el.style.msTransitionDuration =
  this.el.style.oTransitionDuration = '';
  return this;
};

/**
 * Start animation, optionally calling `fn` when complete.
 *
 * @param {Function} fn
 * @return {Move} for chaining
 * @api public
 */

Move.prototype.end = function(fn){
  var self = this;

  // emit "start" event
  this.emit('start');

  // transforms
  if (this._transforms.length) {
    this.setVendorProperty('transform', this._transforms.join(' '));
  }

  // transition properties
  this.setVendorProperty('transition-properties', this._transitionProps.join(', '));
  this.applyProperties();

  // callback given
  if (fn) this.then(fn);

  // emit "end" when complete
  after.once(this.el, function(){
    self.reset();
    self.emit('end');
  });

  return this;
};

}, {"after-transition":18,"has-translate3d":19,"emitter":9,"css-ease":20,"query":21}],
18: [function(require, module, exports) {

/**
 * dependencies
 */

var has = require('has-transitions')
  , emitter = require('css-emitter')
  , once = require('once');

/**
 * Transition support.
 */

var supported = has();

/**
 * Export `after`
 */

module.exports = after;

/**
 * Invoke the given `fn` after transitions
 *
 * It will be invoked only if the browser
 * supports transitions __and__
 * the element has transitions
 * set in `.style` or css.
 *
 * @param {Element} el
 * @param {Function} fn
 * @return {Function} fn
 * @api public
 */

function after(el, fn){
  if (!supported || !has(el)) return fn();
  emitter(el).bind(fn);
  return fn;
};

/**
 * Same as `after()` only the function is invoked once.
 *
 * @param {Element} el
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

after.once = function(el, fn){
  var callback = once(fn);
  after(el, fn = function(){
    emitter(el).unbind(fn);
    callback();
  });
};

}, {"has-transitions":22,"css-emitter":23,"once":24}],
22: [function(require, module, exports) {

/**
 * Check if `el` or browser supports transitions.
 *
 * @param {Element} el
 * @return {Boolean}
 * @api public
 */

exports = module.exports = function(el){
  switch (arguments.length) {
    case 0: return bool;
    case 1: return bool
      ? transitions(el)
      : bool;
  }
};

/**
 * Check if the given `el` has transitions.
 *
 * @param {Element} el
 * @return {Boolean}
 * @api private
 */

function transitions(el, styl){
  if (el.transition) return true;
  styl = window.getComputedStyle(el);
  return !! styl.transition;
}

/**
 * Style.
 */

var styl = document.body.style;

/**
 * Export support.
 */

var bool = 'transition' in styl
  || 'webkitTransition' in styl
  || 'MozTransition' in styl
  || 'msTransition' in styl;

}, {}],
23: [function(require, module, exports) {
/**
 * Module Dependencies
 */

var events = require('event');

// CSS events

var watch = [
  'transitionend'
, 'webkitTransitionEnd'
, 'oTransitionEnd'
, 'MSTransitionEnd'
, 'animationend'
, 'webkitAnimationEnd'
, 'oAnimationEnd'
, 'MSAnimationEnd'
];

/**
 * Expose `CSSnext`
 */

module.exports = CssEmitter;

/**
 * Initialize a new `CssEmitter`
 *
 */

function CssEmitter(element){
  if (!(this instanceof CssEmitter)) return new CssEmitter(element);
  this.el = element;
}

/**
 * Bind CSS events.
 *
 * @api public
 */

CssEmitter.prototype.bind = function(fn){
  for (var i=0; i < watch.length; i++) {
    events.bind(this.el, watch[i], fn);
  }
  return this;
};

/**
 * Unbind CSS events
 * 
 * @api public
 */

CssEmitter.prototype.unbind = function(fn){
  for (var i=0; i < watch.length; i++) {
    events.unbind(this.el, watch[i], fn);
  }
  return this;
};

/**
 * Fire callback only once
 * 
 * @api public
 */

CssEmitter.prototype.once = function(fn){
  var self = this;
  function on(){
    self.unbind(on);
    fn.apply(self.el, arguments);
  }
  self.bind(on);
  return this;
};


}, {"event":3}],
24: [function(require, module, exports) {

/**
 * Identifier.
 */

var n = 0;

/**
 * Global.
 */

var global = (function(){ return this })();

/**
 * Make `fn` callable only once.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

module.exports = function(fn) {
  var id = n++;

  function once(){
    // no receiver
    if (this == global) {
      if (once.called) return;
      once.called = true;
      return fn.apply(this, arguments);
    }

    // receiver
    var key = '__called_' + id + '__';
    if (this[key]) return;
    this[key] = true;
    return fn.apply(this, arguments);
  }

  return once;
};

}, {}],
19: [function(require, module, exports) {

var prop = require('transform-property');

// IE <=8 doesn't have `getComputedStyle`
if (!prop || !window.getComputedStyle) {
  module.exports = false;

} else {
  var map = {
    webkitTransform: '-webkit-transform',
    OTransform: '-o-transform',
    msTransform: '-ms-transform',
    MozTransform: '-moz-transform',
    transform: 'transform'
  };

  // from: https://gist.github.com/lorenzopolidori/3794226
  var el = document.createElement('div');
  el.style[prop] = 'translate3d(1px,1px,1px)';
  document.body.insertBefore(el, null);
  var val = getComputedStyle(el).getPropertyValue(map[prop]);
  document.body.removeChild(el);
  module.exports = null != val && val.length && 'none' != val;
}

}, {"transform-property":25}],
25: [function(require, module, exports) {

var styles = [
  'webkitTransform',
  'MozTransform',
  'msTransform',
  'OTransform',
  'transform'
];

var el = document.createElement('p');
var style;

for (var i = 0; i < styles.length; i++) {
  style = styles[i];
  if (null != el.style[style]) {
    module.exports = style;
    break;
  }
}

}, {}],
20: [function(require, module, exports) {

/**
 * CSS Easing functions
 */

module.exports = {
    'in':                'ease-in'
  , 'out':               'ease-out'
  , 'in-out':            'ease-in-out'
  , 'snap':              'cubic-bezier(0,1,.5,1)'
  , 'linear':            'cubic-bezier(0.250, 0.250, 0.750, 0.750)'
  , 'ease-in-quad':      'cubic-bezier(0.550, 0.085, 0.680, 0.530)'
  , 'ease-in-cubic':     'cubic-bezier(0.550, 0.055, 0.675, 0.190)'
  , 'ease-in-quart':     'cubic-bezier(0.895, 0.030, 0.685, 0.220)'
  , 'ease-in-quint':     'cubic-bezier(0.755, 0.050, 0.855, 0.060)'
  , 'ease-in-sine':      'cubic-bezier(0.470, 0.000, 0.745, 0.715)'
  , 'ease-in-expo':      'cubic-bezier(0.950, 0.050, 0.795, 0.035)'
  , 'ease-in-circ':      'cubic-bezier(0.600, 0.040, 0.980, 0.335)'
  , 'ease-in-back':      'cubic-bezier(0.600, -0.280, 0.735, 0.045)'
  , 'ease-out-quad':     'cubic-bezier(0.250, 0.460, 0.450, 0.940)'
  , 'ease-out-cubic':    'cubic-bezier(0.215, 0.610, 0.355, 1.000)'
  , 'ease-out-quart':    'cubic-bezier(0.165, 0.840, 0.440, 1.000)'
  , 'ease-out-quint':    'cubic-bezier(0.230, 1.000, 0.320, 1.000)'
  , 'ease-out-sine':     'cubic-bezier(0.390, 0.575, 0.565, 1.000)'
  , 'ease-out-expo':     'cubic-bezier(0.190, 1.000, 0.220, 1.000)'
  , 'ease-out-circ':     'cubic-bezier(0.075, 0.820, 0.165, 1.000)'
  , 'ease-out-back':     'cubic-bezier(0.175, 0.885, 0.320, 1.275)'
  , 'ease-out-quad':     'cubic-bezier(0.455, 0.030, 0.515, 0.955)'
  , 'ease-out-cubic':    'cubic-bezier(0.645, 0.045, 0.355, 1.000)'
  , 'ease-in-out-quart': 'cubic-bezier(0.770, 0.000, 0.175, 1.000)'
  , 'ease-in-out-quint': 'cubic-bezier(0.860, 0.000, 0.070, 1.000)'
  , 'ease-in-out-sine':  'cubic-bezier(0.445, 0.050, 0.550, 0.950)'
  , 'ease-in-out-expo':  'cubic-bezier(1.000, 0.000, 0.000, 1.000)'
  , 'ease-in-out-circ':  'cubic-bezier(0.785, 0.135, 0.150, 0.860)'
  , 'ease-in-out-back':  'cubic-bezier(0.680, -0.550, 0.265, 1.550)'
};

}, {}],
21: [function(require, module, exports) {
function one(selector, el) {
  return el.querySelector(selector);
}

exports = module.exports = function(selector, el){
  el = el || document;
  return one(selector, el);
};

exports.all = function(selector, el){
  el = el || document;
  return el.querySelectorAll(selector);
};

exports.engine = function(obj){
  if (!obj.one) throw new Error('.one callback required');
  if (!obj.all) throw new Error('.all callback required');
  one = obj.one;
  exports.all = obj.all;
  return exports;
};

}, {}],
15: [function(require, module, exports) {

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var div = document.createElement('div');
// Setup
div.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
// Make sure that link elements get serialized correctly by innerHTML
// This requires a wrapper element in IE
var innerHTMLBug = !div.getElementsByTagName('link').length;
div = undefined;

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

}, {}],
16: [function(require, module, exports) {
module.exports = '<div class="List">\n    <h1 class="List-title"></h1>\n    <ul class="List-todos"></ul>\n</div>';
}, {}],
17: [function(require, module, exports) {
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
}, {"component/domify":15,"component/event":3,"component/delegate":26,"component/classes":27,"./template.html":28}],
26: [function(require, module, exports) {
/**
 * Module dependencies.
 */

var closest = require('closest')
  , event = require('event');

/**
 * Delegate event `type` to `selector`
 * and invoke `fn(e)`. A callback function
 * is returned which may be passed to `.unbind()`.
 *
 * @param {Element} el
 * @param {String} selector
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function(el, selector, type, fn, capture){
  return event.bind(el, type, function(e){
    var target = e.target || e.srcElement;
    e.delegateTarget = closest(target, selector, true, el);
    if (e.delegateTarget) fn.call(el, e);
  }, capture);
};

/**
 * Unbind event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @api public
 */

exports.unbind = function(el, type, fn, capture){
  event.unbind(el, type, fn, capture);
};

}, {"closest":29,"event":3}],
29: [function(require, module, exports) {
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf, root) {
  element = checkYoSelf ? {parentNode: element} : element

  root = root || document

  // Make sure `element !== document` and `element != null`
  // otherwise we get an illegal invocation
  while ((element = element.parentNode) && element !== document) {
    if (matches(element, selector))
      return element
    // After `matches` on the edge case that
    // the selector matches the root
    // (when the root is not the document)
    if (element === root)
      return
  }
}

}, {"matches-selector":30}],
30: [function(require, module, exports) {
/**
 * Module dependencies.
 */

var query = require('query');

/**
 * Element prototype.
 */

var proto = Element.prototype;

/**
 * Vendor function.
 */

var vendor = proto.matches
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Expose `match()`.
 */

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  if (vendor) return vendor.call(el, selector);
  var nodes = query.all(selector, el.parentNode);
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i] == el) return true;
  }
  return false;
}

}, {"query":21}],
27: [function(require, module, exports) {
/**
 * Module dependencies.
 */

var index = require('indexof');

/**
 * Whitespace regexp.
 */

var re = /\s+/;

/**
 * toString reference.
 */

var toString = Object.prototype.toString;

/**
 * Wrap `el` in a `ClassList`.
 *
 * @param {Element} el
 * @return {ClassList}
 * @api public
 */

module.exports = function(el){
  return new ClassList(el);
};

/**
 * Initialize a new ClassList for `el`.
 *
 * @param {Element} el
 * @api private
 */

function ClassList(el) {
  if (!el || !el.nodeType) {
    throw new Error('A DOM element reference is required');
  }
  this.el = el;
  this.list = el.classList;
}

/**
 * Add class `name` if not already present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.add = function(name){
  // classList
  if (this.list) {
    this.list.add(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (!~i) arr.push(name);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Remove class `name` when present, or
 * pass a regular expression to remove
 * any which match.
 *
 * @param {String|RegExp} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.remove = function(name){
  if ('[object RegExp]' == toString.call(name)) {
    return this.removeMatching(name);
  }

  // classList
  if (this.list) {
    this.list.remove(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (~i) arr.splice(i, 1);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Remove all classes matching `re`.
 *
 * @param {RegExp} re
 * @return {ClassList}
 * @api private
 */

ClassList.prototype.removeMatching = function(re){
  var arr = this.array();
  for (var i = 0; i < arr.length; i++) {
    if (re.test(arr[i])) {
      this.remove(arr[i]);
    }
  }
  return this;
};

/**
 * Toggle class `name`, can force state via `force`.
 *
 * For browsers that support classList, but do not support `force` yet,
 * the mistake will be detected and corrected.
 *
 * @param {String} name
 * @param {Boolean} force
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.toggle = function(name, force){
  // classList
  if (this.list) {
    if ("undefined" !== typeof force) {
      if (force !== this.list.toggle(name, force)) {
        this.list.toggle(name); // toggle again to correct
      }
    } else {
      this.list.toggle(name);
    }
    return this;
  }

  // fallback
  if ("undefined" !== typeof force) {
    if (!force) {
      this.remove(name);
    } else {
      this.add(name);
    }
  } else {
    if (this.has(name)) {
      this.remove(name);
    } else {
      this.add(name);
    }
  }

  return this;
};

/**
 * Return an array of classes.
 *
 * @return {Array}
 * @api public
 */

ClassList.prototype.array = function(){
  var str = this.el.className.replace(/^\s+|\s+$/g, '');
  var arr = str.split(re);
  if ('' === arr[0]) arr.shift();
  return arr;
};

/**
 * Check if class `name` is present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.has =
ClassList.prototype.contains = function(name){
  return this.list
    ? this.list.contains(name)
    : !! ~index(this.array(), name);
};

}, {"indexof":31}],
31: [function(require, module, exports) {
module.exports = function(arr, obj){
  if (arr.indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
}, {}],
28: [function(require, module, exports) {
module.exports = '<li class="Todo">\n    <input class="Todo-checkbox" style="display:none" type="checkbox" id="" value="None" name="complete"/>\n    <label for=""></label>\n    <div class="Todo-titleContainer">\n        <div class="Todo-title u-sizeFill" contentEditable></div>\n    </div>\n    <span class="Todo-icon">\n        <span class="Icon Icon--delete">\n            <?xml version="1.0" encoding="iso-8859-1"?>\n            <!-- Generator: Adobe Illustrator 18.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n            <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n            <svg version="1.1" class="Icon--deleteSVG" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"\n                 viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve">\n                    <path style="fill-rule:evenodd;clip-rule:evenodd;" d="M21.987,11.44c-0.015-0.363-0.15-0.723-0.428-1\n                        c-0.277-0.277-0.637-0.413-1-0.428c-0.404-0.017-0.813,0.119-1.121,0.428L16,13.879l-3.438-3.439\n                        c-0.309-0.309-0.717-0.444-1.121-0.428c-0.363,0.015-0.723,0.15-1,0.428c-0.277,0.277-0.413,0.637-0.428,1\n                        c-0.017,0.404,0.119,0.812,0.428,1.121L13.879,16l-3.438,3.438c-0.309,0.309-0.444,0.717-0.428,1.121\n                        c0.015,0.363,0.15,0.723,0.428,1c0.277,0.277,0.637,0.413,1,0.428c0.404,0.017,0.812-0.119,1.121-0.428L16,18.121l3.439,3.439\n                        c0.309,0.309,0.717,0.444,1.121,0.428c0.363-0.015,0.723-0.15,1-0.428c0.277-0.277,0.413-0.637,0.428-1\n                        c0.017-0.404-0.119-0.812-0.428-1.121L18.121,16l3.438-3.438C21.868,12.253,22.004,11.845,21.987,11.44z M16,0\n                        C7.164,0,0,7.164,0,16c0,8.836,7.164,16,16,16c8.836,0,16-7.164,16-16C32,7.164,24.836,0,16,0z M16,29C8.832,29,3,23.168,3,16\n                        C3,8.832,8.832,3,16,3s13,5.832,13,13C29,23.168,23.168,29,16,29z"/>\n            </svg>\n        </span>\n    </span>\n</li>';
}, {}],
6: [function(require, module, exports) {
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
}, {"component/emitter":9,"component/classes":27,"component/domify":15,"./template.html":32}],
32: [function(require, module, exports) {
module.exports = '<div class="BottomBar">\n    <div class="Grid BottomBar-navContainer">\n        <a href="yesterday/" class="Grid-cell u-size1of4 BottomBar-navItem">Yesterday</a>\n        <a href="" class="Grid-cell u-size1of4 BottomBar-navItem">Today</a>\n        <a href="complete/" class="Grid-cell u-size1of4 BottomBar-navItem">Complete</a>\n        <a href="incomplete/" class="Grid-cell u-size1of4 BottomBar-navItem">Incomplete</a>\n    </div>\n    <div class="BottomBar-inputContainer">\n        <input type="text" class="BottomBar-input">\n    </div>\n</div>';
}, {}]}, {}, {"1":""})

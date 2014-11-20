var myth = require('myth');
var fs = require('fs');
var join = require('path').join;
var cwd = process.cwd();
var css;
var converted;

var path = join(cwd, 'build');
css = fs.readFileSync(join(path, 'index.css'), 'utf8');
converted = myth(css);

fs.writeFileSync(join(path, 'index.css'), converted);
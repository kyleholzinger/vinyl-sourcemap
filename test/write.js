'use strict';

var fs = require('fs');
var path = require('path');
var File = require('vinyl');
var expect = require('expect');
var sourcemaps = require('..');
var stream = require('stream');

var sourceContent = fs.readFileSync(path.join(__dirname, 'assets/helloworld.js')).toString();

function makeSourceMap() {
	return {
		version: 3,
		file: 'helloworld.js',
		names: [],
		mappings: '',
		sources: ['helloworld.js'],
		sourcesContent: [sourceContent]
	};
}

function makeFile() {
	var file = new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'helloworld.js'),
		contents: new Buffer(sourceContent),
		sourceMap: makeSourceMap(),
	});
	return file;
}

function makeNestedFile() {
	var file = new File({
		cwd: __dirname,
		base: path.join(__dirname, 'assets'),
		path: path.join(__dirname, 'assets', 'dir1', 'dir2', 'helloworld.js'),
		contents: new Buffer(sourceContent)
	});
	file.sourceMap = makeSourceMap();
	return file;
}

function base64JSON(object) {
	return 'data:application/json;charset=utf8;base64,' + new Buffer(JSON.stringify(object)).toString('base64');
}

describe('write', function() {

	describe('ensures file argument', function() {

		it('is not undefined', function(done) {
			sourcemaps.write(undefined, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not null', function(done) {
			sourcemaps.write(null, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is not a plain object', function(done) {
			sourcemaps.write({}, function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		// TODO: seems like a bad test
		it('is not a stream', function(done) {
			sourcemaps.write(new stream.Readable(), function(err) {
				expect(err instanceof Error && err.message === 'vinyl-sourcemap-write: Not a vinyl file').toExist();
				done();
			});
		});

		it('is a vinyl object', function(done) {
			var file = makeFile();
			sourcemaps.write(file, function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	describe('ensures options argument', function() {

		it('is not mutated', function(done) {
			var defaultedOpts = {
				includeContent: true,
				addComment: true,
			};

			var opts = {};

			var file = makeFile();
			sourcemaps.write(file, opts, function(err) {
				expect(opts).toNotEqual(defaultedOpts);
				done(err);
			});
		});

		it('is defaulted if undefined', function(done) {
			var file = makeFile();
			sourcemaps.write(file, undefined, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if null', function(done) {
			var file = makeFile();
			sourcemaps.write(file, null, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if empty string', function(done) {
			var file = makeFile();
			sourcemaps.write(file, '', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if non-empty string', function(done) {
			var file = makeFile();
			sourcemaps.write(file, 'invalid', function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean false', function(done) {
			var file = makeFile();
			sourcemaps.write(file, false, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if boolean true', function(done) {
			var file = makeFile();
			sourcemaps.write(file, true, function(err) {
				expect(err).toNotExist();
				done();
			});
		});

		it('is defaulted if array', function(done) {
			var file = makeFile();
			sourcemaps.write(file, [], function(err) {
				expect(err).toNotExist();
				done();
			});
		});
	});

	it('calls back with the untouched file if sourceMap property does not exist', function(done) {
		var file = makeFile();
		delete file.sourceMap;
		sourcemaps.write(file, function(err, outFile) {
			expect(err).toNotExist();
			expect(file).toExist();
			expect(outFile).toEqual(file);
			done(err);
		});
	});

	it('should write an inline source map', function(done) {
		var file = makeFile();
		sourcemaps.write(file, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile).toExist();
			expect(sourceMapFile).toNotExist();
			// TODO: Vinyl.isVinyl
			expect(updatedFile instanceof File).toExist();
			expect(updatedFile).toEqual(file);
			expect(String(updatedFile.contents)).toBe( sourceContent + '\n//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\n');
			done(err);
		});
	});

	it('should use CSS comments if CSS file', function(done) {
		var file = makeFile();
		file.path = file.path.replace('.js', '.css');
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent + '\n/*# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + ' */\n');
			done(err);
		});
	});

	it('should write no comment if not JS or CSS file', function(done) {
		var file = makeFile();
		file.path = file.path.replace('.js', '.txt');
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent);
			done(err);
		});
	});

	it('should detect detect whether a file uses \\n or \\r\\n and follow the existing style', function(done) {
		var file = makeFile();
		file.contents = new Buffer(file.contents.toString().replace(/\n/g, '\r\n'));
		sourcemaps.write(file, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent.replace(/\n/g, '\r\n') + '\r\n//# sourceMappingURL=' + base64JSON(updatedFile.sourceMap) + '\r\n');
			done(err);
		});
	});

	it('should write external map files', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { path: '../maps', destPath: 'dist' }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile instanceof File).toExist();
			expect(updatedFile).toEqual(file);
			expect(String(updatedFile.contents)).toBe(sourceContent + '\n//# sourceMappingURL=../maps/helloworld.js.map\n');
			expect(updatedFile.sourceMap.file).toBe('../dist/helloworld.js');
			expect(sourceMapFile instanceof File).toExist();
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'maps/helloworld.js.map'));
			expect(JSON.parse(sourceMapFile.contents)).toEqual(updatedFile.sourceMap);
			expect(sourceMapFile.stat.isFile()).toExist();
			expect(sourceMapFile.stat.isDirectory()).toNotExist();
			expect(sourceMapFile.stat.isBlockDevice()).toNotExist();
			expect(sourceMapFile.stat.isCharacterDevice()).toNotExist();
			expect(sourceMapFile.stat.isSymbolicLink()).toNotExist();
			expect(sourceMapFile.stat.isFIFO()).toNotExist();
			expect(sourceMapFile.stat.isSocket()).toNotExist();
			done(err);
		});
	});

	it('should create shortest path to map in file comment', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: 'dir1/maps' }, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent + '\n//# sourceMappingURL=../maps/dir1/dir2/helloworld.js.map\n');
			done(err);
		});
	});

	it('should write no comment with option addComment=false', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { addComment: false }, function(err, updatedFile) {
			expect(String(updatedFile.contents)).toBe(sourceContent);
			done(err);
		});
	});

	it('should not include source content with option includeContent=false', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { includeContent: false }, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourcesContent).toBe(undefined);
			done(err);
		});
	});

	it('should fetch missing sourceContent', function(done) {
		var file = makeFile();
		delete file.sourceMap.sourcesContent;
		sourcemaps.write(file, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourcesContent).toNotBe(undefined);
			expect(updatedFile.sourceMap.sourcesContent).toEqual([sourceContent]);
			done(err);
		});
	});

	it('should not throw when unable to fetch missing sourceContent', function(done) {
		var file = makeFile();
		file.sourceMap.sources[0] += '.invalid';
		delete file.sourceMap.sourcesContent;
		sourcemaps.write(file, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourcesContent).toNotBe(undefined);
			expect(updatedFile.sourceMap.sourcesContent).toEqual([]);
			done(err);
		});
	});

	it('should set the sourceRoot by option sourceRoot', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { sourceRoot: '/testSourceRoot' }, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('/testSourceRoot');
			done(err);
		});
	});

	it.skip('should set the sourceRoot by option sourceRoot, as a function', function(done) {
		var file = makeFile();
		sourcemaps.write(file, {
			sourceRoot: function() {
				return '/testSourceRoot';
			}
		}, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('/testSourceRoot');
			done(err);
		});
	});

	it('should automatically determine sourceRoot if destPath is set', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: '.', destPath: 'dist', includeContent: false }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('../../../assets');
			expect(updatedFile.sourceMap.file).toBe('helloworld.js');
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'assets/dir1/dir2/helloworld.js.map'));
			done(err);
		});
	});

	it('should interpret relative path in sourceRoot as relative to destination', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: '.', sourceRoot: '../src' }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('../../../src');
			expect(updatedFile.sourceMap.file).toBe('helloworld.js');
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'assets/dir1/dir2/helloworld.js.map'));
			done(err);
		});
	});

	it('should interpret relative path in sourceRoot as relative to destination (part 2)', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: '.', sourceRoot: '' }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('../..');
			expect(updatedFile.sourceMap.file).toBe('helloworld.js');
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'assets/dir1/dir2/helloworld.js.map'));
			done(err);
		});
	});

	it('should interpret relative path in sourceRoot as relative to destination (part 3)', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: 'maps', sourceRoot: '../src' }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('../../../../src');
			expect(updatedFile.sourceMap.file).toBe('../../../dir1/dir2/helloworld.js');
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'assets/maps/dir1/dir2/helloworld.js.map'));
			done(err);
		});
	});

	it('should interpret relative path in sourceRoot as relative to destination (part 4)', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: '../maps', sourceRoot: '../src', destPath: 'dist' }, function(err, updatedFile, sourceMapFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('../../../src');
			expect(updatedFile.sourceMap.file).toBe('../../../dist/dir1/dir2/helloworld.js');
			expect(sourceMapFile.path).toBe(path.join(__dirname, 'maps/dir1/dir2/helloworld.js.map'));
			done(err);
		});
	});

	it('should accept a sourceMappingURLPrefix', function(done) {
		var file = makeFile();
		sourcemaps.write(file, {
			path: '../maps',
			sourceMappingURLPrefix: 'https://asset-host.example.com'
		}, function(err, updatedFile) {
			if (/helloworld\.js$/.test(updatedFile.path)) {
				expect(/sourceMappingURL.*\n$/.exec(String(updatedFile.contents))[0]).toEqual('sourceMappingURL=https://asset-host.example.com/maps/helloworld.js.map\n');
				done(err);
			}
		});
	});

	it.skip('should accept a sourceMappingURLPrefix, as a function', function(done) {
		var file = makeFile();
		sourcemaps.write(file, {
			path: '../maps',
			sourceMappingURLPrefix: function() {
				return 'https://asset-host.example.com';
			}
		}, function(err, updatedFile) {
			if (/helloworld\.js$/.test(updatedFile.path)) {
				expect(/sourceMappingURL.*\n$/.exec(String(updatedFile.contents))[0]).toEqual('sourceMappingURL=https://asset-host.example.com/maps/helloworld.js.map\n');
				done(err);
			}
		});
	});

	it.skip('should output an error message if debug option is set and sourceContent is missing', function(done) {
		var file = makeFile();
		file.sourceMap.sources[0] += '.invalid';
		delete file.sourceMap.sourcesContent;
		var hConsole = ''; // removed
		sourcemaps.write(file, { debug: true }, function(err) {
			expect(hConsole.history.log[0]).toBe('vinyl-sourcemap-write: No source content for "helloworld.js.invalid". Loading from file.');
			expect(hConsole.history.warn[0].indexOf('vinyl-sourcemap-write: source file not found: ') === 0).toExist();
			done(err);
		});
	});

	it('null as sourceRoot, should not set the sourceRoot', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { sourceRoot: null }, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe(undefined);
			done(err);
		});
	});

	it.skip('should write function returning null as sourceRoot not set the sourceRoot', function(done) {
		var file = makeFile();
		sourcemaps.write(file, {
			sourceRoot: function() {
				return null;
			}
		}, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe(undefined);
			done(err);
		});
	});

	it('empty string as sourceRoot should be kept', function(done) {
		var file = makeFile();
		sourcemaps.write(file, { sourceRoot: '' }, function(err, updatedFile) {
			expect(updatedFile.sourceMap.sourceRoot).toBe('');
			done(err);
		});
	});

	it.skip('should be able to fully control sourceMappingURL by the option sourceMappingURL', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, {
			path: '../aaa/bbb/',
			sourceMappingURL: function(file) {
				return 'http://maps.example.com/' + file.relative + '.map';
			}
		}, function(err, updatedFile) {
			if (/helloworld\.js$/.test(updatedFile.path)) {
				expect(String(updatedFile.contents)).toBe(sourceContent + '\n//# sourceMappingURL=http://maps.example.com/dir1/dir2/helloworld.js.map\n');
				done(err);
			}
		});
	});

	it('should create shortest path to file in sourceMap#file', function(done) {
		var file = makeNestedFile();
		sourcemaps.write(file, { path: 'dir1/maps' }, function(err, updatedFile) {
			expect(updatedFile.sourceMap.file).toEqual('../../../dir2/helloworld.js');
			done(err);
		});
	});
});

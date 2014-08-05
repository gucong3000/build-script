"use strict";
var gulp = require("gulp"),
	fs = require("fs"),
	msgErrs = {};

/**
 * 读取JSON格式文件
 * @param  {String}   file     文件路径
 * @param  {Function} callback 数据返回接口回调
 */
function readJSON(file, callback) {
	fs.readFile(file, {
		encoding: "utf-8"
	}, function(err, jsonstr) {
		if (!err) {
			callback(JSON.parse(jsonstr));
		}
	});
}

/**
 * 异常处理
 * @param  {Error} e 错误对象
 */
function errrHandler(e) {
	var msg = e.toString().replace(/\x1B\[\d+m/g, ""),
		msgbox = require("native-msg-box");
	if (!msgErrs[msg]) {
		msgErrs[msg] = msg;
		console.log(msg);
		msgbox.prompt({
			msg: msg,
			title: "gulp throw a error"
		}, function() {
			msgErrs[msg] = null;
		});
	}
}

/**
 * 寻找项目根目录
 * @return {String} 项目根目录地址
 */
function findRoot() {
	var paths = ["./", "../yiifrontendtff/", "../tff/"],
		path,
		i;
	for (i = 0; i < paths.length; i++) {
		path = paths[i];
		if (fs.existsSync(path + "index.php")) {
			return path;
		}
	}
}

/**
 * 文件编译任务
 * @param  {Object} opt css、js输入输出目录
 */
function compiler(opt) {
	opt = opt || {};
	if (!opt.scriptDest) {
		opt.scriptDest = "./js/";
	}
	if (!opt.styleDest) {
		opt.styleDest = "./css/";
	}
	if (!opt.scriptSrc) {
		opt.scriptSrc = opt.scriptDest + "src/";
	}
	if (!opt.styleSrc) {
		opt.styleSrc = opt.styleDest + "src/";
	}

	var autoprefixer = require("gulp-autoprefixer"),
		sourcemaps = require("gulp-sourcemaps"),
		livereload = require("gulp-livereload"),
		plumber = require("gulp-plumber"),
		wrapper = require("gulp-wrapper"),
		jshint = require("gulp-jshint"),
		filter = require("gulp-filter"),
		rename = require("gulp-rename"),
		watch = require("gulp-watch"),
		less = require("gulp-less"),
		lessFile = opt.styleSrc + "**/*.less",
		lockerTimer,
		locker,
		uglify = opt.noCompress ? rename : require("gulp-uglify"),
		uglifyOpt = {
			//保留IE的jscript条件注释
			preserveComments: function(o, info) {
				return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
			}
		};

	/**
	 * git未锁定项目时执行
	 * @param  {Function} callback 要执行的回调函数
	 */
	function doWhenNotLock(callback) {
		if (!locker) {
			if (fs.existsSync("./.git/index.lock")) {
				locker = true;
				clearTimeout(lockerTimer);
				setTimeout(function() {
					locker = false;
				}, 3000);
				return;
			}
			return callback();
		}
	}

	/**
	 * less转css
	 * @param  {[File[]]} files less文件
	 * @return {File[]} css文件
	 */
	function less2css(files) {
		return doWhenNotLock(function() {
			return (files || gulp.src([lessFile])).pipe(filter(["*.less", "!**/*.module.less"]))
				.pipe(plumber(errrHandler))
				.pipe(sourcemaps.init())
				.pipe(less({
					compress: !opt.noCompress
				}))
				.pipe(autoprefixer("last 3 version", "ie > 5", "Android >= 2.1", "Safari >= 5.1", "iOS >= 6"))
				.pipe(sourcemaps.write({
					sourceRoot: "/css/src"
				}))
				.pipe(gulp.dest(opt.styleDest));
		});
	}

	// js文件编译，htc文件编译
	watch({
		glob: [opt.scriptSrc + "**/*.js"]
	}, function(files) {
		return doWhenNotLock(function() {
			var htcFilter = filter(["*.htc.js"]),
				modFilter = filter(["*.module.js"]),
				jsFilter = filter(["*js", "!*.htc.js", "!*.module.js", "!*.min.js", "!*-min.js", "!jquery.pie.js", "!selectivizr.js"]);

			// 错误捕获
			return files.pipe(plumber(errrHandler))

			// 处理js文件
			.pipe(jsFilter)
				.pipe(jshint())
				.pipe(jshint.reporter("fail"))
				.pipe(sourcemaps.init())
				.pipe(uglify(uglifyOpt))
				.pipe(sourcemaps.write({
					sourceRoot: "/js/src"
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(jsFilter.restore())

			// 处理htc文件
			.pipe(htcFilter)
				.pipe(jshint({
					predef: ["element"]
				}))
				.pipe(jshint.reporter("fail"))
				.pipe(uglify(uglifyOpt))
				.pipe(wrapper({
					header: "<PUBLIC:COMPONENT lightWeight=\"true\"><SCRIPT>",
					footer: "</SCRIPT></PUBLIC:COMPONENT>",
				}))
				.pipe(rename({
					extname: ""
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(htcFilter.restore())

			// 处理js模块
			.pipe(modFilter)
				.pipe(jshint({
					predef: ["require", "exports", "module"]
				}))
				.pipe(jshint.reporter("fail"))
				.pipe(sourcemaps.init())
				.pipe(uglify(uglifyOpt))
				.pipe(rename(function(path) {
					path.basename = path.basename.replace(/\.\w+$/, "");
				}))
				.pipe(wrapper({
					header: function(file) {
						return "define(\"" + file.path.match(/(\w+)(\.\w+)+$/)[1] + "\", function(require, exports, module) {";
					},
					footer: "});"
				}))
				.pipe(sourcemaps.write({
					sourceRoot: "/js/src"
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(modFilter.restore());

			// .pipe(jsFilter)
		});
	});

	// less文件编译
	watch({
		glob: lessFile
	}, function(files) {
		return doWhenNotLock(function() {
			return less2css(files);
		});
	});

	// less组件发生变化时重编译所有less文件
	gulp.watch(opt.styleSrc + "**/*.module.less", function() {
		return doWhenNotLock(function() {
			return less2css();
		});
	});

	// 打开Livereload
	setTimeout(function() {
		var timer;
		livereload.listen();
		gulp.watch(["./protected/views/**/*.*", opt.styleDest + "**/*.css", "!" + opt.styleSrc + "**/*.css", opt.scriptDest + "**/*.js", "!" + opt.scriptSrc + "**/*.js"], function(event) {
			clearTimeout(timer);
			timer = setTimeout(function() {
				livereload.changed(event);
			}, 200);
		});
	}, 800);

}


/**
 * 项目初始化
 * @param  {String} strPath 项目目录
 */
function init(strPath) {

	// "url": "https://github.com/jquery/jquery.git"
	var path = require("path"),
		workPath = path.resolve(strPath);

	console.log("work path:\t" + workPath);

	readJSON("package.json", function(pkg) {
		var request = require("request"),
			url = pkg.repository.url,
			netPkg,
			pkgUrl;
		if (url) {
			url = url.replace(/\.\w+$/, "/");
			pkgUrl = url + "raw/master/package.json?raw=true";
			request(pkgUrl, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					netPkg = JSON.parse(body);
					if (netPkg.version !== pkg.version) {
						[".jshintignore", ".jshintrc", "gulpfile.js", "package.json"].forEach(function(fileName) {
							request(url + "raw/master/" + fileName + "?raw=true").pipe(fs.createWriteStream(fileName));
						});
					}
				}
			});
		}
	});

	(function(pre_commit_path) {
		//声明 githook脚本

		var pre_commit = "#!/bin/sh\ngulp --gulpfile " + path.relative(strPath, __dirname).replace(/\\/g, "\/") + "/gulpfile.js test\nexit $?";

		fs.readFile(pre_commit_path, {
			encoding: "utf-8"
		}, function(err, pre_commit_old) {
			if (pre_commit_old !== pre_commit) {
				//写入git hook脚本
				fs.writeFile(pre_commit_path, pre_commit, function(err) {
					if (!err) {
						console.log("init:\tgit hook pre-commit");
					}
				});
			}
		});

	})(strPath + ".git/hooks/pre-commit");

	(function(gitignore_path) {
		//检查git忽略提交文件
		fs.readFile(gitignore_path, {
			encoding: "utf-8"
		}, function(err, gitignore_contents) {
			if (!err) {
				var files_ignore = [".jshintrc", ".jshintignore", "Gruntfile.js", "package.json", "node_modules", "npm-debug.log", "gulpfile.js"].filter(function(filename) {
					if (filename && gitignore_contents.indexOf(filename) < 0) {
						return true;
					} else {
						return false;
					}
				});
				if (files_ignore && files_ignore.length) {
					//写入git忽略文件列表
					fs.appendFile(gitignore_path, "\n" + files_ignore.join("\n"), function(err) {
						if (!err) {
							console.log("init:\t" + files_ignore.join(",") + " is add to ignore files");
						}
					});
				}
			}
		});
	})(strPath + ".gitignore");

	if (workPath !== __dirname) {
		gulp.src([".jshintrc", ".jshintignore"]).pipe(gulp.dest(strPath));
	}
}

/**
 * 查找修改了的文件
 * @param  {Function} callback 返回结果回调
 * @param  {Boolean} cached 只查找索引了的文件
 */
function findDiff(callback, cached) {
	var root = findRoot();

	require("child_process").exec("git diff --name-only" + (cached ? " --cached" : ""), {
			cwd: root
		},
		function(err, stdout, stderr) {
			if (stderr) {
				process.exit(-1);
			}

			var files = stdout.split(/[\r\n]/).filter(function(path) {
				return !!path;
			}).map(function(path) {
				return root + path.trim();
			});
			if (cached) {
				callback(files);
			} else {
				findDiff(function(filesCached) {
					callback(files.concat(filesCached));
				}, true);
			}

		});
}

/**
 * 代码检查
 * @param  {Array[String]} files 要检查的文件路径
 */
function fileTest(files) {
	var scrFiles = files.filter(function(path) {
			return /\.(css|js|less)$/.test(path) && !/\/\/# sourceMappingURL/.test(fs.readFileSync(path));
		}),
		jsFiles = scrFiles.filter(function(path) {
			return /\.js$/.test(path);
		}),
		cssFiles = scrFiles.filter(function(path) {
			return /\.css$/.test(path);
		}),
		lessFiles = scrFiles.filter(function(path) {
			return /\.less$/.test(path);
		}),
		gulp,
		jshint;
	if (scrFiles.length) {
		if (cssFiles.length) {
			console.log("应通过编译方式修改：" + cssFiles);
			process.exit(-1);
		}
		gulp = require("gulp");
		if (jsFiles.length) {
			jshint = require("gulp-jshint");
			gulp.src(jsFiles).pipe(jshint()).pipe(jshint.reporter("fail"));
		}
		if (lessFiles.length) {
			gulp.src(lessFiles).pipe(require("gulp-less")());
		}
	}
}

/**
 * 默认任务
 */
gulp.task("default", function() {
	var path = findRoot();
	init(path);
	compiler({
		noCompress: process.argv.indexOf("--no-compress") > 0,
		scriptSrc: path + "js/src/",
		styleSrc: path + "css/src/",
		scriptDest: path + "js/",
		styleDest: path + "css/"
	});
});

/**
 * 修复js任务
 */
gulp.task("fix", function() {
	// var args = process.argv.slice(2);

	findDiff(function(files) {
		files = files.filter(function(path) {
			return /\.js$/.test(path) && !/\/\/# sourceMappingURL/.test(fs.readFileSync(path));
		});
		if (files.length) {
			var fixmyjs = require("gulp-fixmyjs");
			readJSON("./.jshintrc", function(jshintrc) {
				files.forEach(function(path) {
					gulp.src(path)
						.pipe(require("gulp-plumber")(errrHandler))
						.pipe(fixmyjs(jshintrc))
						.pipe(gulp.dest("."));
				});
			});
		}
	});

});

/**
 * test任务
 */
gulp.task("test", function() {
	findDiff(fileTest, true);
});

/**
 * jsDoc任务
 */
gulp.task("doc", function() {
	var yuidoc = require("gulp-yuidoc");
	return gulp.src(findRoot() + "js/src/*.js")
		// return gulp.src("../h5form/src/*.js")
		.pipe(require("gulp-filter")(["*.js", "!*.*.js", "!*-min.js"]))
		.pipe(yuidoc({}, {
			themedir: "../documentation/development/frontend/jsdoc/"
		}))
		.pipe(gulp.dest("../documentation/development/frontend/jsdoc/"));
});
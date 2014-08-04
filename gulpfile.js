"use strict";
var gulp = require("gulp"),
	fs = require("fs");

function oompiler(opt) {
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

	var msgbox = require("native-msg-box"),
		autoprefixer = require("gulp-autoprefixer"),
		sourcemaps = require("gulp-sourcemaps"),
		livereload = require("gulp-livereload"),
		plumber = require("gulp-plumber"),
		wrapper = require("gulp-wrapper"),
		jshint = require("gulp-jshint"),
		filter = require("gulp-filter"),
		uglify = require("gulp-uglify"),
		watch = require("gulp-watch"),
		// sass = require("gulp-sass"),
		less = require("gulp-less"),
		ext = require("gulp-ext"),
		lessFile = opt.styleSrc + "**/*.less",
		// scssFile = opt.styleSrc + "**/*.scss",
		msgErrs = {},
		lockerTimer,
		locker,
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
	 * 异常处理
	 * @param  {Error} e 错误对象
	 */
	function errrHandler(e) {
		var msg = e.toString().replace(/\x1B\[\d+m/g, "");
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
					compress: true
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
					header: "<PUBLIC:COMPONENT lightWeight=\"true\"><SCRIPT>\n",
					footer: "\n</SCRIPT></PUBLIC:COMPONENT>",
				}))
				.pipe(ext.replace(""))
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
				.pipe(wrapper({
					header: "define(function(require, exports, module) {\n",
					footer: "\n});"
				}))
				.pipe(ext.replace(""))
				.pipe(ext.replace("js"))
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


function init() {

	(function(pre_commit_path) {
		//声明 githook脚本
		var pre_commit = "#!/bin/sh\ngulp test\nexit $?",
			pre_commit_old;

		try {
			pre_commit_old = fs.readFileSync(pre_commit_path, "utf-8");
		} catch (ex) {}

		//写入git hook脚本
		if (pre_commit_old !== pre_commit) {
			fs.writeFileSync(pre_commit_path, pre_commit);
			console.log("git hook pre-commit");
		}
	})(".git/hooks/pre-commit");

	(function(gitignore_path) {
		//检查git忽略提交文件
		var gitignore_msg,
			gitignore_contents = fs.readFileSync(gitignore_path, "utf-8"),
			files_ignore = [".jshintrc", ".jshintignore", "Gruntfile.js", "package.json", "node_modules", "npm-debug.log", "gulpfile.js"].filter(function(filename) {
				if (filename && gitignore_contents.indexOf(filename) < 0) {
					return true;
				} else {
					return false;
				}
			});

		//写入git忽略文件列表
		if (files_ignore && files_ignore.length) {
			gitignore_msg = files_ignore.join(",") + " is add to " + gitignore_path;
			files_ignore.unshift(gitignore_contents);
			fs.writeFileSync(gitignore_path, files_ignore.join("\n").replace(/\n+/g, "\n"));
			console.log(gitignore_msg);
		}
	})(".gitignore");

	// (function() {
	// 	//修改less编译器，使之输出的调试信息使用相对路径
	// 	var parser_path = "node_modules/less/lib/less/parser.js",
	// 		parser_contents = fs.readFileSync(parser_path, "utf-8"),
	// 		re_str = /filename\s*=\s*require\('path'\).resolve\(filename\);/;
	// 	if (re_str.test(parser_contents)) {
	// 		parser_contents = parser_contents.replace(re_str, "filename = filename.replace(/\\\\/g, \"/\");");
	// 		fs.writeFileSync(parser_path, parser_contents);
	// 		console.log(parser_path + " is fixed.");
	// 	}
	// })();
}

/**
 * 默认任务
 */
gulp.task("default", function() {
	init();
	oompiler();
});

/**
 * 修复js任务
 */
gulp.task("fix", function() {
	var fixmyjs = require("gulp-fixmyjs");
	gulp.src("./js/base.js")
		.pipe(fixmyjs({
			"browser": true,
			"boss": true,
			"curly": true,
			"eqeqeq": true,
			"eqnull": true,
			"expr": true,
			"immed": true,
			"noarg": true,
			"onevar": true,
			"quotmark": "double",
			"smarttabs": true,
			"trailing": true,
			"undef": true,
			"unused": true,
			"strict": true,
			"jquery": true,
			"node": true,
			"predef": [
				"define",
				"require"
			]
		}))
		.pipe(gulp.dest("./js/src/"));
});

function fileTest(files) {
	var scrFiles = files.filter(function(path) {
			return /\.(css|js|less|scss|coffee)$/.test(path) && !/\/\/# sourceMappingURL/.test(fs.readFileSync(path));
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
			gulp.src(jsFiles).pipe(jshint()).pipe(jshint.reporter("default"));
		}
		if (lessFiles.length) {
			gulp.src(lessFiles).pipe(require("gulp-less")());
		}
	}
}

/**
 * test任务
 */
gulp.task("test", function() {
	var exec = require("child_process").exec;
	exec("git diff --cached --name-only", function(err, stdout, stderr) {
		if (stderr) {
			process.exit(-1);
		}

		var files = stdout.split(/[\r\n]/).map(function(path) {
			return path.trim();
		}).filter(function(path) {
			return !!path;
		});

		if (files.length) {
			fileTest(files);
		}

	});
});

"use strict";
var gulp = require("gulp"),
	path = require("path"),
	fs = require("fs"),
	msgErrs = {},
	upProcess;

/**
 * 读取JSON格式文件
 * @param	{String}		file		文件路径
 * @param	{Function}	callback	数据返回接口回调
 */
function readJSON(file, callback) {
	fs.readFile(file, {
		encoding: "utf-8"
	}, function(err, jsonstr) {
		if (!err) {
			try {
				callback(JSON.parse(jsonstr));
			} catch (ex) {
				callback(eval.call({}, "(" + jsonstr + ")"));
			}
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
		if (e.plugin !== "gulp-jshint") {
			console.log(JSON.stringify(e, 0, 4).trim() || msg);
		}
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
	var dir = process.argv.indexOf("--path"),
		i;
	return dir >= 0 ? process.argv[dir + 1] : (function() {
		var paths = [".", "../yiifrontendtff", "../tff", "../yiifrontendt4f", "../t4f", "../yiimobile", "../yii"];
		for (i = 0; i < paths.length; i++) {
			dir = paths[i];
			if (fs.existsSync(path.join(dir, "index.php"))) {
				return dir;
			}
		}
		return ".";
	})();
}

/**
 * 文件编译任务
 * @param  {Object} opt css、js输入输出目录
 */
function compiler(opt) {
	opt = opt || {};
	if (!opt.scriptDest) {
		opt.scriptDest = "./script/";
	}
	if (!opt.styleDest) {
		opt.styleDest = "./style/";
	}
	if (!opt.scriptSrc) {
		opt.scriptSrc = "./script.src/";
	}
	if (!opt.styleSrc) {
		opt.styleSrc = "./style.src/";
	}
	if (!opt.rootPath) {
		opt.rootPath = "./";
	}

	var allCompiler = process.argv.indexOf("--compiler") > 0,
		autoprefixer = require("gulp-autoprefixer"),
		sourcemaps = require("gulp-sourcemaps"),
		livereload = require("gulp-livereload"),
		plumber = require("gulp-plumber"),
		wrapper = require("gulp-wrapper"),
		jshint = require("gulp-jshint"),
		filter = require("gulp-filter"),
		rename = require("gulp-rename"),
		tmodjs = require('gulp-tmod'),
		watch = allCompiler ? function(globs, fn) {
			return fn(gulp.src(globs));
		} : require("gulp-watch"),
		less = require("gulp-less"),
		lessFile = opt.styleSrc + "**/*.less",
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
			if (fs.existsSync(path.join(findRoot(), ".git/index.lock"))) {
				locker = true;
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
				.pipe(autoprefixer({
					browsers: ["last 3 version", "ie > 5", "Android >= 2.1", "Safari >= 5.1", "iOS >= 6"]
				}))
				.pipe(sourcemaps.write(".", {
					sourceRoot: opt.styleSrc
				}))
				.pipe(gulp.dest(opt.styleDest));
		});
	}

	// js文件编译，htc文件编译
	watch(opt.scriptSrc + "**/*.js", function(files) {
		return doWhenNotLock(function() {
			var htcFilter = filter(["**/*.htc.js"]),
				modFilter = filter(["**/*.module.js"]),
				jsFilter = filter(["*.js", "!**/*.htc.js", "!**/*.module.js", "!**/*.min.js", "!**/*-min.js"]);

			// 错误捕获
			return files.pipe(plumber(errrHandler))

			// 处理js文件
			.pipe(jsFilter)
				.pipe(jshint())
				.pipe(jshint.reporter("fail"))
				.pipe(sourcemaps.init())
				.pipe(uglify(uglifyOpt))
				.pipe(sourcemaps.write(".", {
					sourceRoot: opt.scriptSrc
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(jsFilter.restore())

			// 处理htc文件
			.pipe(htcFilter)
				.pipe(jshint({
					predef: ["element"]
				}))
				.pipe(jshint.reporter("fail"))
				.pipe(jshint.reporter())
				.pipe(uglify(uglifyOpt))
				.pipe(wrapper({
					header: "<PUBLIC:COMPONENT lightWeight=\"true\"><SCRIPT>",
					footer: "</SCRIPT><script type=\"text/vbscript\"></script></PUBLIC:COMPONENT>",
				}))
				.pipe(rename({
					extname: ""
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(htcFilter.restore())

			// 处理js模块
			.pipe(modFilter)
				.pipe(jshint({
					globalstrict: true,
					jquery: false
				}))
				.pipe(jshint.reporter("fail"))
				.pipe(jshint.reporter())
				.pipe(sourcemaps.init())
				.pipe(uglify(uglifyOpt))
				.pipe(rename(function(path) {
					path.basename = path.basename.replace(/\.\w+$/, "");
				}))
				.pipe(wrapper({
					header: function(file) {
						return "(function(f){typeof define===\"function\"?define(\"" + file.path.match(/([^\/\\]+)(\.\w+)$/)[1] + "\",f):f()})(function(require,exports,module){";
					},
					footer: "});"
				}))
				.pipe(sourcemaps.write(".", {
					sourceRoot: opt.scriptSrc
				}))
				.pipe(gulp.dest(opt.scriptDest))
				.pipe(modFilter.restore());

			// .pipe(jsFilter)
		});
	});

	// less文件编译
	watch(lessFile, function(files) {
		return doWhenNotLock(function() {
			return less2css(files);
		});
	});

	// html模板编译为js模块
	watch(opt.scriptSrc + "**/*.html", function(files) {
		return doWhenNotLock(function() {
			return files.pipe(tmodjs({
				output: opt.scriptDest,
				base: opt.scriptSrc,
				combo: false,
				type: "cmd"
			}));
		});
	});

	if (!allCompiler) {
		// less组件发生变化时重编译所有less文件
		gulp.watch(opt.styleSrc + "**/*.module.less", function() {
			return doWhenNotLock(function() {
				return less2css();
			});
		});

		// 打开Livereload
		setTimeout(function() {
			livereload.listen();
			gulp.watch([opt.rootPath + "**/*.html", opt.rootPath + "protected/views/**/*.php", opt.styleDest + "**/*.css", "!" + opt.styleSrc + "**/*.css", opt.scriptDest + "**/*.js", "!" + opt.scriptSrc + "**/*.js"], livereload.changed);
		}, 800);
	}
}

/**
 * 自动升级
 */
function update() {
	if (!upProcess) {
		upProcess = true;
		readJSON("package.json", function(pkg) {
			console.log("当前版本：" + pkg.version);
			// 读取package.json，按其写明的代码库地址去获取在线版本package.json
			var child_process = require("child_process"),
				request = require("request"),
				url = pkg.repository.url,
				netPkg,
				pkgUrl;
			if (url) {
				url = url.replace(/\.\w+$/, "/");
				pkgUrl = url + "raw/master/package.json?raw=true";
				request(pkgUrl, function(error, response, body) {
					if (!error && response.statusCode === 200) {
						netPkg = JSON.parse(body);
						// 检查线上的package.json中的version是否与本地相等
						if (netPkg.version !== pkg.version) {
							// 下载这几个文件到本地
							[".jshintignore", ".jshintrc", "gulpfile.js", "package.json"].forEach(function(fileName) {
								request(url + "raw/master/" + fileName).pipe(fs.createWriteStream(path.join(__dirname, fileName)));
							});
							// 更新与本地版本号有差异的node模块
							for (var i in netPkg.devDependencies) {
								if (netPkg.devDependencies[i] !== pkg.devDependencies[i]) {
									child_process.exec("npm update --save-dev " + i);
								}
							}
						}
					}
				});
			}
		});
	}
}

/**
 * 项目初始化
 * @param  {String} strPath 项目目录
 */
function init(strPath) {

	var workPath = path.resolve(strPath),
		isLocal = workPath === __dirname;

	console.log("work path:\t" + workPath);

	(function(pre_commit_path) {
		//声明 githook脚本

		var pre_commit = "#!/bin/sh\ngulp test --path " + strPath.replace(/\\/g, "/") + (isLocal ? "" : (" --gulpfile " + path.relative(strPath, __dirname).replace(/\\/g, "/") + "/gulpfile.js")) + "\nexit $?";

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

	})(path.join(strPath, ".git/hooks/pre-commit"));

	(function(gitignore_path) {
		//检查git忽略提交文件
		fs.readFile(gitignore_path, {
			encoding: "utf-8"
		}, function(err, gitignore_contents) {
			if (!err) {
				gitignore_contents = gitignore_contents.split(/\r?\n/g);
				var files_ignore = [".jshintrc", ".jshintignore", "Gruntfile.js", "package.json", "node_modules", "npm-debug.log", "gulpfile.js"].filter(function(filename) {
					//将“.gitignore”文件中已有的项目排除
					return filename && gitignore_contents.indexOf(filename) < 0;
				});
				if (files_ignore && files_ignore.length) {
					//追加方式写入git忽略文件列表
					fs.appendFile(gitignore_path, "\n" + files_ignore.join("\n"), function(err) {
						if (!err) {
							console.log("init:\t" + files_ignore.join(",") + " is add to ignore files");
						}
					});
				}
			}
		});
	})(path.join(strPath, ".gitignore"));

	// if (!isLocal) {
	// 	gulp.src([".jshintrc", ".jshintignore"]).pipe(gulp.dest(strPath));
	// }
}

/**
 * 代码检查
 * @param  {Array[String]} files 要检查的文件路径
 * @return {[Array[String]]} 需要添加到git的文件修改
 */
function fileTest(files) {
	var returnFiles = [],

		scrFiles = files.filter(function(path) {
			// 取出png图片将其压缩
			if (/\.png$/.test(path)) {
				optiImg(path, 7);
				returnFiles.push(path);
				return false;
			} else {
				var buf = fs.readFileSync(path);
				// 检查所有待提交的文件，去除BOM头
				if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
					fs.writeFileSync(path, buf.slice(3));
					returnFiles.push(path);
				}
			}
			return true;
		}).filter(function(path) {
			// 过滤掉压缩版的js和css，并过滤掉css、js、less以外的文件
			return /\.(css|js|less|html?)$/.test(path) && !/\/\/# sourceMappingURL/.test(fs.readFileSync(path));
		}),
		jsFiles = scrFiles.filter(function(path) {
			// 将js文件单独列出
			return /\.js$/.test(path);
		}),
		cssFiles = scrFiles.filter(function(path) {
			// 将css文件单独列出
			return /\.css$/.test(path);
		}),
		lessFiles = scrFiles.filter(function(path) {
			// 将less文件单独列出
			return /\.less$/.test(path);
		}),
		htmlFile = scrFiles.filter(function(path) {
			// 将html文件单独列出
			return /\.html?$/.test(path);
		}),
		gulp,
		jshint,
		htmlhint;
	if (scrFiles.length) {
		if (cssFiles.length) {
			console.log("应通过编译方式修改：" + cssFiles);
			process.exit(-1);
		}
		gulp = require("gulp");
		if (jsFiles.length) {
			// jshint检查js文件
			jshint = require("gulp-jshint");
			gulp.src(jsFiles).pipe(jshint()).pipe(jshint.reporter("fail"));
		}
		if (htmlFile.length) {
			// jshint检查js文件
			htmlhint = require("gulp-htmlhint");
			gulp.src(htmlFile).pipe(htmlhint({
				"doctype-first": false
			})).pipe(htmlhint.reporter());
		}
		if (lessFiles.length) {
			// less文件检查
			gulp.src(lessFiles).pipe(require("gulp-less")());
		}
	}
	if (returnFiles.length) {
		return returnFiles;
	}
}

/**
 * 图片压缩
 * @param  {String} 图片文件路径
 * @param  {[Int = 3]} 压缩级别
 */
function optiImg(strPath, level) {
	var imagemin = require("gulp-imagemin");
	return gulp.src(strPath)
		.pipe(imagemin({
			optimizationLevel: level || 3
		}))
		.pipe(gulp.dest(path.dirname(strPath)));
}

/*
 * 自动升级任务
 */
gulp.task("update", update);

/*
 * 默认任务
 */
gulp.task("default", function() {
	var root = findRoot();
	init(root);
	compiler({
		noCompress: process.argv.indexOf("--no-compress") > 0,
		scriptSrc: path.join(root, "script.src/"),
		styleSrc: path.join(root, "style.src/"),
		scriptDest: path.join(root, "script/"),
		styleDest: path.join(root, "style/"),
		rootPath: root + "/"
	});
	update();
});

/*
 * 旧的路径默认任务
 */
gulp.task("old", function() {
	var root = findRoot();
	init(root);
	compiler({
		noCompress: process.argv.indexOf("--no-compress") > 0,
		scriptSrc: path.join(root, "js/src/"),
		styleSrc: path.join(root, "css/src/"),
		scriptDest: path.join(root, "js/"),
		styleDest: path.join(root, "css/"),
		rootPath: root + "/"
	});
	update();
});

/*
 * 修复js任务
 */
gulp.task("fix", function() {
	var path = findRoot();
	// 从“--path”参数中取出js路径，使用fixmyjs模块重写内容
	readJSON("./.jshintrc", function(jshintrc) {
		fs.readFile(path, function(err, data) {
			if (err) {
				console.log("file not found:\t" + path);
			} else {
				fs.writeFile(path, require("fixmyjs").fix(data.toString(), jshintrc).replace(/  /g, "    "));
			}
		});
	});
});

/*
 * test任务
 */
gulp.task("test", function() {
	var root = findRoot(),
		child_process = require("child_process");

	// 调用git获取已修改文件列表
	child_process.exec("git diff --name-only --cached", {
			cwd: root
		},
		function(err, stdout, stderr) {
			if (stderr) {
				console.log(stderr);
				process.exit(-1);
			}

			// 将git在命令行输出的文件名转为数组
			var files = stdout.split(/[\r\n]/).filter(function(fileName) {
				return !!fileName;
			}).map(function(fileName) {
				// 将项目路径转为相对路径
				return path.join(root, fileName.trim());
			}).filter(function(fileName) {
				return fs.existsSync(fileName);
			});
			if (files.length) {
				var returnFiles = fileTest(files);
				// 如果fileTest返回一个数组，将其添加到git的文件索引中
				if (returnFiles) {
					returnFiles = returnFiles.map(function(item) {
						// 将相对路径转为项目路径
						return path.relative(root, item);
					});

					// 调用git添加文件修改
					child_process.exec("git add \"" + returnFiles.join("\" \"") + "\"", {
						cwd: root
					}, function(err, stdout, stderr) {
						console.log(stderr || stdout);
					});

				}
			}

		});
});

/*
 * jsDoc任务
 */
gulp.task("doc", function() {
	var port = process.argv.indexOf("--port");
	port = port >= 0 ? parseInt(process.argv[port + 1]) : 8080;

	require("yuidocjs").Server.start({
		port: port,
		paths: [path.join(findRoot(), "js/")],
		quiet: true
	});
	require("opener")("http://localhost:" + port);
	update();
});
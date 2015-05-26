/* global escape */
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
		if (e.plugin === "gulp-less") {
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
 * Hex格式颜色值转换，去掉“#”，3位自动变6位
 * @param  {String} string Hex格式颜色
 * @return {String}        Hex格式颜色
 */
function hexColor(string) {
	string = string.replace(/^\W/, "");
	if (string.length === 3) {
		string = string.replace(/(\w)/g, "$1$1");
	}
	return string.toLowerCase();
}

/**
 * 文件下载
 * @param  {Object|String} opt      选项或者url
 * @param  {[String]} filePath 文件保存路径
 */
var downloading = {};

function download(opt, filePath) {
	var url = opt.url || opt;
	if (!downloading[url]) {
		downloading[url] = true;
		var isBinary = /\w+\.(gif|a?png|jpe?g|webp)$/.test(url),
			stream = require("request")(opt, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					if (!isBinary) {
						fs.writeFile(filePath, body);
					}
					console.log("下载成功:\t" + url);
				} else {
					downloading[url] = false;
					console.log("下载失败:\t" + url);
					if (isBinary) {
						setTimeout(function() {
							fs.unlinkSync(filePath);
						}, 200);
					}
				}
			});
		if (!filePath) {
			filePath = url.replace(/^.+\//, "");
		}
		if (isBinary) {
			stream.pipe(fs.createWriteStream(filePath));
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
		htmlhint = require("gulp-htmlhint"),
		plumber = require("gulp-plumber"),
		wrapper = require("gulp-wrapper"),
		replace = require("gulp-replace"),
		jshint = require("gulp-jshint"),
		filter = require("gulp-filter"),
		rename = require("gulp-rename"),
		watch = allCompiler ? function(globs, fn) {
			return fn(gulp.src(globs));
		} : function(globs, fn) {
			var options;
			if (typeof globs === "string") {
				options = {
					base: path.resolve(globs.replace(/\*+.*$/, ""))
				};
			}
			return gulp.watch(globs, function(e) {
				if (e.type !== "deleted") {
					fn(gulp.src([path.resolve(e.path)], options));
				}
			});
		},
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
		try {
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
		} catch (ex) {
			errrHandler(ex);
		}
	}

	/**
	 * 链接文件地址转换为磁盘路径
	 * @param  {String} uri      链接url
	 * @param  {String} filePath 文件所在磁盘路径
	 * @return {String}          链接转为磁盘路径
	 */
	function resolvePath(uri, filePath) {
		if (uri && (uri = uri.trim()) && !/\.less$/.test(uri) && !/^\w+:\w+/.test(uri)) {
			if (/^\//.test(uri)) {
				uri = uri.slice(1);
			} else {
				uri = path.join(filePath.replace(/[^\\\/]+$/, ""), uri);
			}
			return path.resolve(opt.rootPath, uri).replace(/(\.eot)\?#\w+$/, "$1").replace(/#.*$/, "");
		}
	}

	/**
	 * css文件中的链接处理插件
	 * @param  {Function} callback 链接处理函数
	 * @return {Through}            [description]
	 */
	function cssUrls(callback) {
		var through = require("through2");
		return through.obj(function(file, enc, cb) {
			if (file.isNull()) {
				cb(null, file);
				return;
			}

			if (file.isStream()) {
				cb(console.log("gulp-cssUrls", "Streaming not supported"));
				return;
			}
			var css = file.contents.toString().replace(/\burl\(\s*("|')?(.*?)\1\s*\)/ig, function(s, quote, url) {
				var filePath = resolvePath(url, file.path);
				return filePath ? "url(" + (callback(url, filePath) || url) + ")" : s;
			});

			file.contents = new Buffer(css);
			this.push(file);
			cb();
		});
	}

	/**
	 * css中url方式引入资源处理
	 * @param  {String} uri 文件旧的uri
	 * @return {String}     处理后的uri
	 */
	function loadingIcon(uri, filePath) {
		var urlInfo = uri.match(/\bajaxload.info\W(\d+)(\W[a-f\d]+)?(\W[a-f\d]+)?/i);
		if (urlInfo) {
			var type = urlInfo[1],
				color1 = urlInfo[2],
				color2 = urlInfo[3],
				colorInfo = hexColor(color1 || "fff") + hexColor(color2 || "000"),
				fileUri = "imgs/ajaxload_info/" + type + "_" + colorInfo + ".gif",
				url;
			filePath = path.join(opt.rootPath, fileUri);

			if (!fs.existsSync(filePath)) {
				url = "http://ajaxload.info/cache/" + colorInfo.replace(/(\w{2})/g, "$1/") + type + "-1.gif";
				console.log("正在文件下载：\n" + url + "\n" + filePath);
				download({
					url: url,
					headers: {
						Host: "ajaxload.info",
						Referer: "http://ajaxload.info/"
					}
				}, filePath);
			}
			uri = "/" + fileUri;
			return uri;
		}
	}

	/**
	 * url后拼接文件MD5
	 * @param  {String} uri      原始的rul
	 * @param  {String} filePath 文件磁盘路径
	 * @return {String}          拼接md5之后的url
	 */
	function filemd5(uri, filePath) {
		if (fs.existsSync(filePath)) {
			var fileCont = fs.readFileSync(filePath);
			var sum = require("crypto").createHash("md5");
			if (/(^text|\+xml$)/.test(require("mime").lookup(filePath))) {
				fileCont = fileCont.toString().trim().replace(/\r\n?/g, "\n");
			}
			sum.update(fileCont);
			// URL query生成
			return uri.replace(/\??(#[^#]+)?$/, "?" + sum.digest("hex") + "$1");
		}
	}

	/**
	 * 将css文件中的url转为datauri格式
	 * @param  {String} uri      原始的URL
	 * @param  {String} filePath 文件磁盘路径
	 * @return {String}          datauri代码
	 */
	function datauri(uri, filePath) {
		if (/#data\W?ur[il]/i.test(uri) && fs.existsSync(filePath)) {
			// 文件query生成
			return JSON.stringify(require("datauri")(filePath));
		}
	}

	/**
	 * less转css
	 * @param  {[File[]]} files less文件
	 * @return {File[]} css文件
	 */
	function less2css(files) {
		return doWhenNotLock(function() {
			return (files || gulp.src([lessFile])).pipe(filter(["**/*.less", "!**/*.module.less"]))
				.pipe(plumber(errrHandler))
				.pipe(sourcemaps.init())
				.pipe(less({
					compress: !opt.noCompress,
					paths: [path.resolve(opt.rootPath)]
				}))
				.pipe(cssUrls(function(url, filePath) {
					return loadingIcon(url) || datauri(url, filePath) || filemd5(url, filePath);
				}))
				.pipe(autoprefixer({
					browsers: ["last 3 version", "ie > 8", "Android >= 3", "Safari >= 5.1", "iOS >= 5"]
				}))
				.pipe(sourcemaps.write(".", {
					sourceRoot: "/" + path.relative(opt.rootPath, opt.styleSrc).replace(/\\/g, "/")
				}))
				.pipe(gulp.dest(opt.styleDest));
		});
	}

	/**
	 * 根据文件路径，转换为js模块id
	 * @param  {Object} file gulp-wrapper 插件所给出的文件信息
	 * @return {String}       js格式字符串
	 */
	function moduleName(file) {
		return JSON.stringify(path.relative(opt.scriptSrc, file.path).replace(/\\/g, "/").replace(/\.\w+$/, ""));
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
					sourceRoot: "/" + path.relative(opt.rootPath, opt.scriptSrc).replace(/\\/g, "/")
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
						return "(function(f){typeof define===\"function\"?define(" + moduleName(file) + ",f):f()})(function(require,exports,module){";
					},
					footer: "});"
				}))
				.pipe(sourcemaps.write(".", {
					sourceRoot: "/" + path.relative(opt.rootPath, opt.scriptSrc).replace(/\\/g, "/")
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
			return files.pipe(plumber(errrHandler))
				.pipe(replace(/^[\s\S]*$/, function(html) {
					return require("art-template").compile(html.replace(/\s+/g, " ")).toString().replace(/\binclude\s*\(\s*([^\,\)]+)/g, "require($1);include($1");
				}))
				.pipe(uglify(uglifyOpt))
				.pipe(replace(/^(function) \w+/, "$1"))
				.pipe(wrapper({
					header: function(file) {
						return "/*TMODJS:{}*/\ndefine(" + moduleName(file) + ",function(require,exports,module){module.exports=require(\"template\")(module.id,";
					},
					footer: ")});"
				}))
				.pipe(rename(function(path) {
					path.extname = ".js";
				}))
				.pipe(gulp.dest(opt.scriptDest));
		});
	});

	if (!allCompiler) {
		// html规范检查
		watch([opt.scriptSrc + "**/*.html", opt.rootPath + "protected/views/**/*.html"], function(files) {
			return doWhenNotLock(function() {
				return files.pipe(plumber(errrHandler))
					.pipe(replace(/\{\s*%[\s\S]+?%\s*\}/g, ""))
					.pipe(replace(/\{\{[\s\S]+?\}\}/g, escape))
					.pipe(htmlhint({
						"doctype-first": false
					}))
					.pipe(htmlhint.reporter())
					.pipe(htmlhint.failReporter());
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
									child_process.exec("npm update");
									break;
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

	// 先判断当前目录是否为git项目目录
	fs.exists(path.join(strPath, ".git"), function(exists) {
		if (exists) {
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

			if (!isLocal) {
				[".jshintrc", ".jshintignore"].forEach(function(filename) {
					fs.writeFileSync(path.join(strPath, filename), fs.readFileSync(filename));
				});
			}
		}
	});

}

/**
 * 代码检查
 * @param  {Array[String]} files 要检查的文件路径
 * @return {[Array[String]]} 需要添加到git的文件修改
 */
function fileTest(files) {
	/**
	 * 判断路径不在 .jshintignore 文件中
	 * @param  {String} path 路径
	 * @return {Boolean}     不存在于 .jshintignore 文件中
	 */
	function notIgnore(path) {
		path = path.replace(/\\/g, "/");
		var result = true;
		jshintignore.forEach(function(ignorePath) {
			if (path.indexOf(ignorePath) >= 0) {
				result = false;
				return result;
			}
		});
		return result;
	}

	var jshintignore = fs.readFileSync(".jshintignore").toString().trim().split(/\r?\n/),
		returnFiles = [],

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
			// 过滤掉压缩版的js和css，并过滤掉css、js、less、html以外的文件，过滤掉.jshintignore声明的文件，过滤掉TMODJS文件
			return /\.(css|js|less|html?)$/i.test(path) && notIgnore(path) && !/(^\/\*\s*TMODJS\s*:|\/\/# sourceMappingURL[^\n]+$)/.test(fs.readFileSync(path));
		}),
		jsFiles = scrFiles.filter(function(path) {
			// 将js文件单独列出
			return /\.js$/.test(path) && !(/[\.\-]min\.js$/.test(path));
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
		replace,
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
			gulp.src(jsFiles).pipe(jshint()).pipe(jshint.reporter()).pipe(jshint.reporter("fail"));
		}
		if (htmlFile.length) {
			// jshint检查js文件
			htmlhint = require("gulp-htmlhint");
			replace = require("gulp-replace");
			gulp.src(htmlFile)
				.pipe(replace(/\{\{[\s\S]+?\}\}/g, escape))
				.pipe(replace(/\{\s*%[\s\S]+?%\s*\}/g, ""))
				.pipe(htmlhint({
					"doctype-first": false,
					"id-unique": false
				}))
				.pipe(htmlhint.reporter())
				.pipe(htmlhint.failReporter());
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
 * 默认任务
 */
gulp.task("m", function() {
	var root = findRoot();
	init(root);
	compiler({
		noCompress: process.argv.indexOf("--no-compress") > 0,
		scriptSrc: path.join(root, "js.src/"),
		styleSrc: path.join(root, "css.src/"),
		scriptDest: path.join(root, "js/"),
		styleDest: path.join(root, "css/"),
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
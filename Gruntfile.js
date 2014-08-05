module.exports = function(grunt) {
	"use strict";

	function readOptionalJSON(filepath) {
		var data = {};
		try {
			data = grunt.file.readJSON(filepath);
		} catch (e) {}
		return data;
	}

	grunt.initConfig({
		pkg: readOptionalJSON("package.json"),
		//js文档生成
		yuidoc: {
			compile: {
				name: "<%= pkg.name %>",
				description: "<%= pkg.description %>",
				version: "<%= pkg.version %>",
				url: "<%= pkg.homepage %>",
				options: {
					outdir: "../documentation/development/frontend/jsdoc/",
					themedir: "node_modules/yuidocjs/themes/simple",
					paths: "js/src/"
				}
			}
		},
		//js代码压缩与合并
		uglify: {
			options: {
				//添加banner
				banner: "/*! <%= pkg.name %> <%= grunt.template.today('yyyy-mm-dd') %> */\n",
				//保留IE的jscript条件注释
				preserveComments: function(o, info) {
					return /@(cc_on|if|else|end|_jscript(_\w+)?)\s/i.test(info.value);
				}
			},
			htc: {
				options: {
					banner: "<PUBLIC:COMPONENT lightWeight=\"true\"><SCRIPT>\n\n\/\/created by grunt, DO NOT edit!!!\n\n", //添加banner
					footer: "\n</SCRIPT></PUBLIC:COMPONENT>",
				},
				files: [{
					expand: true,
					cwd: "js/src", //js/src目录下
					src: ["*.htc.js"], //所有*.htc.js文件
					dest: "js", //输出到此目录下
					ext: ".htc"
				}]
			},
			js: {
				options: {
					banner: ""
				},
				files: [{
					expand: true,
					cwd: "js", //js目录下
					src: ["**/*.js", "!**/src/*.*", "!cruise_slide.js"], //所有js文件
					dest: "assets/js" //输出到此目录下
				}]
			}
		},

		copy: {
			js: {
				files: [{
					expand: true,
					cwd: "js/src", //js/src目录下
					src: ["**/*.js", "!*.min.js", "!*-min.js", "!jquery.pie.js", "!*.htc.js"], //所有js文件
					dest: "js" //输出到此目录下
				}]
			},
			misc: {
				files: [{
					//js目录下js文件外杂项文件，如图片等
					expand: true,
					cwd: "js",
					src: ["**/*.*", "!**/*.js", "!**/src/*.*"], //所有除js文件外杂项文件
					dest: "assets/js" //输出到此目录下
				}, {
					//css目录下除css文件外杂项文件，如图片等
					expand: true,
					cwd: "css", //css目录下
					src: ["**/*.*", "!**/*.css", "!**/src/*.*"], //所有除css文件外杂项文件
					dest: "assets/js" //输出到此目录下
				}]
			},
		},

		//文件合并
		concat: {
			merger: {
				files: {
					//文件copy
					"js/jquery.js": ["js/src/jquery-1.7.2.min.js"],
					"js/nwmatcher.js": ["js/src/nwmatcher-1.2.5-min.js"],
					//jquery.pie.js与PIE合并
					"js/PIE_IE678.js": ["js/src/PIE_IE678.min.js", "js/src/jquery.pie.js"],
					"js/PIE_IE9.js": ["js/src/PIE_IE9.min.js", "js/src/jquery.pie.js"],
				}
			}
		},

		//js代码风格检查
		jshint: {
			options: {
				jshintrc: true
			},
			htc: {
				src: ["js/src/**/*.htc.js"]
			},
			js: {
				src: ["Gruntfile.js", "js/src/**/*.js", "!js/**/*.htc.js"]
			}
		},
		sass: {
			options: {
				outputStyle: "nested",
			},

			buildall: {
				files: [{
					expand: true,
					cwd: "css/src",
					src: ["**/*.scss", "!**/*.module.scss"],
					dest: "assets/css",
					ext: ".css"
				}]
			}
		},
		//编译less
		less: {
			options: {
				//编译后的文件加入行号信息
				dumpLineNumbers: "comments",
				//css压缩
				/*compress: true*/
			},
			buildall: {
				files: [{
					expand: true,
					cwd: "css/src",
					src: ["**/*.css", "**/*.less", "!**/*.module.less"],
					dest: "assets/css",
					ext: ".css"
				}]
			}
		},
		//自动css前缀插件
		autoprefixer: {
			options: {
				//填写需要兼容的浏览器范围，各浏览器最新两版及IE6以上
				browsers: ["last 2 version", "ie > 5", "Android >= 2.1", "Safari >= 5.1", "iOS >= 6"]
			},
			buildall: {
				files: [{
					expand: true,
					cwd: "assets/css",
					src: ["**/*.css"],
					dest: "css",
				}]
			}
		},
		//css压缩
		cssmin: {
			compress: {
				files: [{
					expand: true,
					cwd: "css",
					src: ["**/*.css", "!**/src/*.*"],
					dest: "assets/css",
				}]
			}
		},
		//文件清理
		clean: {
			css: {
				src: ["assets/css/**/*.*"]
			},
			js: {
				src: ["assets/js/**/*.*"]
			}
		},
		//文件变化监控
		watch: {
			options: {
				livereload: true
			},
			other: {
				files: ["**/*.html", "**/*.php"]
			},
			js: {
				files: ["js/src/**/*.js", "!js/**/*.htc.js"],
				tasks: ["clean:js", "jshint:js", "copy:js", "concat"]
			},
			htc: {
				files: ["js/src/**/*.htc.js"],
				tasks: ["jshint:htc", "uglify:htc"]
			},
			sass: {
				files: ["**/*.scss"],
				tasks: ["clean:css", "sass", "autoprefixer"]
			},
			less: {
				files: ["**/*.less"],
				tasks: ["clean:css", "less", "autoprefixer"]
			}
		}
	});

	//sass编译
	grunt.loadNpmTasks("grunt-sass");
	//自动css前缀
	grunt.loadNpmTasks("grunt-autoprefixer");
	//less编译
	grunt.loadNpmTasks("grunt-contrib-less");
	//文件和目录copy
	grunt.loadNpmTasks("grunt-contrib-copy");
	//文件清理插件
	grunt.loadNpmTasks("grunt-contrib-clean");
	//文件合并插件
	grunt.loadNpmTasks("grunt-contrib-concat");
	//代码风格检查插件
	grunt.loadNpmTasks("grunt-contrib-jshint");
	//文件变化监控插件
	grunt.loadNpmTasks("grunt-contrib-watch");
	//js压缩插件
	grunt.loadNpmTasks("grunt-contrib-uglify");
	//自动css压缩
	grunt.loadNpmTasks("grunt-contrib-cssmin");
	//文档生成
	grunt.loadNpmTasks("grunt-contrib-yuidoc");

	grunt.registerTask("default", ["clean", "watch"]);
	grunt.registerTask("dev", ["clean", "jshint", "uglify:htc", "copy:js", "concat", "less", "sass", "autoprefixer", "clean"]);
	grunt.registerTask("publish", ["yuidoc", "dev", "cssmin", "uglify:js", "copy:misc"]);

	//commit任务：专供git的pre-commit hook调用
	grunt.task.registerTask("commit", "pre-commit task.", function() {
		var scrFiles = this.args.filter(function(path) {
				return /\/src\//.test(path);
			}),
			jsFiles = scrFiles.filter(function(path) {
				return /\.js$/.test(path);
			}),
			cssFiles = this.args.filter(function(path) {
				return /\.css$/.test(path);
			}),
			lessFiles = scrFiles.filter(function(path) {
				return /\.less$/.test(path);
			});
		if (jsFiles && jsFiles.length) {
			grunt.config.set("jshint", {
				commit: {
					options: {
						jshintrc: true
					},
					src: jsFiles.concat(["!js/**/*.min.js", "!js/**/*-min.js", "!js/src/selectivizr.js"])
				}
			});
			grunt.task.run(["jshint:commit"]);
		}
		if (lessFiles && lessFiles.length) {
			grunt.task.run(["less", "clean"]);
		} else if (cssFiles && cssFiles.length) {
			cssFiles.forEach(function(csspath) {
				var less_cont,
					lessPath = csspath.replace(/css$/, "less").replace(/^\/?([^\/]+)/, function(s, subPath) {
						return subPath + "/src";
					});
				try {
					less_cont = grunt.file.read(lessPath);
				} catch (ex) {}
				if (less_cont) {
					//grunt.fail.warn(csspath + " 应该通过编译方式修改。");
				}
			});
		}
	});

	//init任务：初始化git，修改less编译器
	grunt.task.registerTask("init", "init task.", function() {

		(function(pre_commit_path) {
			//声明 githook脚本
			var pre_commit = "#!/usr/bin/env node\n(" + function() {
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
							exec("grunt commit:" + files.join(":"), function(err, stdout, stderr) {
								if (err) {
									console.log((stderr || stdout).replace(/\x1B\[\d+m/g, ""));
									process.exit(-1);
								}
							});
						}

					});
				}.toString() + ")();",
				pre_commit_old;

			try {
				pre_commit_old = grunt.file.read(pre_commit_path);
			} catch(ex){
			}

			//写入git hook脚本
			if (pre_commit_old !== pre_commit) {
				grunt.file.write(pre_commit_path, pre_commit);
				grunt.log.writeln("git hook pre-commit");
			}
		})(".git/hooks/pre-commit");

		(function(gitignore_path) {
			//检查git忽略提交文件
			var gitignore_msg,
				gitignore_contents = grunt.file.read(gitignore_path),
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
				grunt.file.write(gitignore_path, files_ignore.join("\n").replace(/\n+/g, "\n"));
				grunt.log.writeln(gitignore_msg);
			}
		})(".gitignore");

		(function() {
			//修改less编译器，使之输出的调试信息使用相对路径
			var parser_path = "node_modules/less/lib/less/parser.js",
				parser_contents = grunt.file.read(parser_path),
				re_str = /filename\s*=\s*require\('path'\).resolve\(filename\);/;
			if (re_str.test(parser_contents)) {
				parser_contents = parser_contents.replace(re_str, "filename = filename.replace(/\\\\/g, \"/\");");
				grunt.file.write(parser_path, parser_contents);
				grunt.log.writeln(parser_path + " is fixed.");
			}
		})();

	});

/*
	grunt.event.on("watch", function(action, filepath, target) {
		if(/.less$/.test(filepath)){
			if(/.module.less$/.test(filepath)){
				grunt.task.run(["less", "autoprefixer", "clean"]);
			} else {

			}
		}

		if(target === "js"){
			grunt.config('jshint.js.src', filepath);
		} else if(target === "htc"){
			console.log("...............");
			grunt.config('jshint.htc.src', filepath);
			//grunt.config('uglify.htc.files.src', filepath);
			grunt.config('uglify.htc.files', {
				"/js/checked.htc": "/js/checked.htc.js"
			});
		}
		grunt.config('jshint.all.src', filepath);
	});
*/
};
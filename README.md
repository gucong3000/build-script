build-script
============

前端代码规范检查，js、css压缩，css预处理、后处理工具

----------

前端部门应使用统一的配置，对配置的修改应该提交至此

## 安装 ##

1. 安装[nodejs](http://nodejs.org/download/),安装后可能需要重启电脑
1. 将安装源设置为中国地区，否则会很慢 `npm config set registry http://registry.cnpmjs.org/ --global`
1. 命令行运行 `npm install -g grunt-cli`
1. 解压 [grunt.rar](grunt.rar?raw=true) 到项目根目录
1. 项目根目录下运行命令 `npm run build`

升级安装只需执行最后两步即可

## 使用 ##

1. 项目根目录运行命令`grunt`
1. 修改文件（`/js/src/*.js`、`/css/src/*less`)，文件会自动编译相关文件，然后浏览器会自动刷新
1. git提交文件时，会检查已修改的代码，不符规则的代码将无法提交
1. 运行'grunt dev'，将会重编译所有文件
1. 运行'grunt publish'，将会生成文档(documentation/development/frontend/jsdoc/)，并压缩前端文件(assets/js,assets/css)

## 浏览器插件 ##

- 浏览器自动刷新插件下载地址
	- [Chrome](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei)
	- [Safari](http://download.livereload.com/2.0.9/LiveReload-2.0.9.safariextz)
	- [Firefox](http://download.livereload.com/2.0.8/LiveReload-2.0.8.xpi)
- less源码位置显示插件下载地址
	- [Firefox](https://addons.mozilla.org/zh-CN/firefox/addon/firecompass-for-firebug/)

## 其他 ##

- [JSHint配置文档](https://github.com/Tours4Fun/documentation/blob/master/development/frontend/jshint_config.md)
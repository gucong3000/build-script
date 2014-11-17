build-script
============

前端代码规范检查，js、css压缩，css预处理、后处理工具

----------

前端部门应使用统一的配置，对配置的修改应该提交至此

## 安装 ##

1. 安装[Node.js](http://nodejs.org/download/),安装后可能需要重启电脑
1. 将安装源设置为中国地区，否则会很慢。命令行运行 `npm config set registry http://registry.cnpmjs.org/ --global`
1. 命令行运行 `npm install -g gulp`
1. 解压 [master.zip](https://github.com/gucong3000/build-script/archive/master.zip) 到项目根目录
1. 运行`npm install`

## 使用 ##

1. 项目根目录运行命令`gulp`
1. 修改文件（`/js/src/*.js`、`/css/src/*less`)，文件会自动编译相关文件，然后浏览器会自动刷新
1. 压缩后的代码有sourceMap，如浏览器不支持，可使用该命令生成未压缩版: `gulp --no-compress`

- git提交文件时，会检查已修改的代码，不符规则的代码将无法提交
- 运行`gulp doc`，可在浏览器中查看文档[http://localhost:8080/](http://localhost:8080/),修改端口参数`gulp doc --port 8080`
- 指定项目源代码路径 `gulp --path ./landingpage/`
- js自动修正功能 `gulp fix --path ./js/base.js`
- BOM头修正功能 `gulp bom` 将移除所有html、css、js、php文件的BOM头

## 免插件自动刷新方式 ##

修改nginx配置如下，添加 `sub_filter`

```
server {
    listen   80;
    server_name qil-dev.tff.com www.qil-dev.tff.com *.qil-dev.tff.com;
    root   /vagrant/yiifrontendtff;
    sub_filter      </body>
        '<!--[if !IE]><!--><script src="http://192.168.56.1:35729/livereload.js"></script></body><!--<![endif]-->';
    sub_filter_once on;
}
```

## 浏览器自动刷新插件下载地址 ##

- [Chrome](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei)
- [Safari](http://download.livereload.com/2.0.9/LiveReload-2.0.9.safariextz)
- [Firefox](http://download.livereload.com/2.0.8/LiveReload-2.0.8.xpi)

## 其他 ##

- [JSHint配置文档](https://github.com/Tours4Fun/documentation/blob/master/development/frontend/jshint_config.md)
build-script
============

前端代码规范检查，js、css压缩，css预处理、后处理工具

----------

前端部门应使用统一的配置，对配置的修改应该提交至此

## 安装 ##

1. 安装[Node.js](http://nodejs.org/download/),安装后可能需要重启电脑
1. 命令行运行 `npm install -g gulp`
1. 解压 [master.zip](https://github.com/gucong3000/build-script/archive/master.zip) 到项目根目录
1. 运行`npm install`

>   在国内安装时，**强烈建议**执行以下命令，使用国内镜像安装：

```bash
npm config set registry https://registry.npm.taobao.org --global
npm config set disturl https://npm.taobao.org/dist --global
npm config set sass_binary_site https://npm.taobao.org/mirrors/node-sass --global
npm config set phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs --global
```

## gulp任务 ##

命令行下运行 `gulp 任务名`，即可运行以下任务

- `default` 文件编译任务(默认任务，任务名可忽略不写)
- `update` 自动升级，升级后请运行`npm update`命令
- `test` 代码检查，供git提交时调用
- `doc` 显示jsDoc文档
- `fix` js文件自动修正代码规范 必须配合`--path`参数指定文件名 eq 	`gulp fix --path js.src/xx.js`

## 参数 ##

- `--compiler` 立即编译所有文件然后退出  eq: `gulp --compiler`
- `--no-compress` 编译文件时不压缩代码 eq: `gulp --no-compress`
- `--path` 指定工作路径 eq: `gulp --path ../landingpage/`
- `--port` 指定文档查看时作为http服务使用的端口号 eq: `gulp doc --port 8080`

## 使用说明 ##

1. 项目根目录运行命令`gulp`
1. 修改文件（`./script.src/*.js`、`./style.src/*less`、`./*.html`、`./protected/views/*.php`)，会自动编译，然后浏览器会自动刷新
1. `gulp --compiler` --compiler 参数会重新编译所有文件，然后退出，不监控文件变化
1. 压缩后的代码有sourceMap，如浏览器不支持，可使用该命令生成未压缩版: `gulp --no-compress`

- 首次运行时会自动关联git钩子，以后git提交文件时，会检查已修改的代码，不符规则的代码将无法提交，同时png图片会自动压缩，文件BOM头会被自动移除
- 多个项目也可公用一份构建工具，在单独的文件夹下解压并运行gulp，每次都加`--path`参数即可

## 配置约定 ##

- js源文件文件请放在`/script.src/`目录下，输出目录为`/script/`
- js源文件需符合jshnt规则验证
- 文件名称为`*.module.js`的文件将会编译为CommonJS规范兼容模块
- less源文件文件请放在`/style.src/`目录下，输出目录为`/style/`
- 文件名称为`*.module.less`的文件将不会被编译为css文件，仅供`@import url("filename.module.less");`方式使用
- less文件中请勿出现浏览器私有属性前缀(如: `-moz-`, `-webkit-`)，除非编译后的css文件中真的缺少你需要的私有属性。
- 编译后css中的静态文件资源，将自动在路径后追加文件MD5，如`backouound:url(/img/some.png?xxxxxxxxxxxxxx);`
- less文件中，静态文件路径后追加`#data-uri`，将会被编译为data-uri格式` background: url(data:image/png;base64,…………) no-repeat;`
- less文件中使用`background: url(/imgs/ajaxload.info/2#000#ccc)`，将会在[ajaxload.info](http://ajaxload.info/)下载动画图标，代码中`2`为图标风格，`#000#ccc`为前景色和背景色，可采用3位或6位RGB格式

## 免插件自动刷新浏览器方法 ##

修改nginx配置如下，添加 `sub_filter`

```
server {
    listen   80;
    server_name qil-dev.tff.com www.qil-dev.tff.com *.qil-dev.tff.com;
    root   /vagrant/yiifrontendtff;
    sub_filter      </body>
        '<!--[if !IE]><!--><script src="http://192.168.56.1:35729/livereload.js"></script><!--<![endif]--></body>';
    sub_filter_once on;
}
```

## 其他 ##

- [JSHint配置文档](https://github.com/Tours4Fun/documentation/blob/master/development/frontend/jshint_config.md)

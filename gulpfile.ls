argv = require 'yargs' .argv

project = argv.project or \aktos
app = argv.app or project
console.log "------------------------------------------"
console.log "Project\t: #{project}"
console.log "App\t: #{app}"
console.log "------------------------------------------"

require! <[ watchify gulp browserify glob path fs globby ]>
require! 'prelude-ls': {union, join, keys}
require! 'vinyl-source-stream': source
require! 'vinyl-buffer': buffer
require! 'gulp-watch': watch
require! 'gulp-pug': pug
require! 'node-notifier': notifier
require! 'gulp-concat': cat
require! 'gulp-uglify': uglify
require! './src/lib/aea': {sleep}
require! './src/lib/aea/ractive-preparserify'
require! 'gulp-flatten': flatten
require! 'gulp-tap': tap
require! 'gulp-cached': cache
require! 'gulp-sourcemaps': sourcemaps
require! 'browserify-livescript'
require! 'run-sequence'

# Build Settings
notification-enabled = yes

# Project Folder Structure

paths = {}
paths.vendor-folder = "#{__dirname}/vendor"
paths.build-folder = "#{__dirname}/build"
paths.client-public = "#{paths.build-folder}/public"
paths.client-src = "#{__dirname}/src/client"
paths.client-apps = "#{paths.client-public}"
paths.client-webapps = "#{__dirname}/apps/#{project}/webapps"
paths.lib-src = "#{__dirname}/src/lib"
paths.components-src = "#{paths.client-src}/components"


notifier.notify {title: "aktos-scada2" message: "Project #{project}:#{app} started!"}

on-error = (source, err) ->
    msg = "GULP ERROR: #{source} :: #{err?.to-string!}"
    notifier.notify {title: "GULP.#{source}", message: msg} if notification-enabled
    console.log msg

log-info = (source, msg) ->
    console-msg = "GULP INFO: #{source} : #{msg}"
    notifier.notify {title: "GULP.#{source}", message: msg} if notification-enabled
    console.log console-msg

is-entry-point = (file) ->
    [filename, ext] = path.basename file .split '.'
    base-dirname = path.basename path.dirname file
    is-main-file = filename is base-dirname

deleteFolderRecursive = (path) ->
    if fs.existsSync(path)
        fs.readdirSync(path).forEach (file,index) ->
            curPath = path + "/" + file
            if(fs.lstatSync(curPath).isDirectory())  # recurse
              deleteFolderRecursive(curPath)
            else
                # delete file
                fs.unlinkSync(curPath)
        fs.rmdirSync(path)

only-compile = yes if argv.compile is true

pug-entry-files = [.. for glob.sync("#{paths.client-webapps}/**/#{app}/*.pug") when is-entry-point ..]
ls-entry-files = [.. for glob.sync "#{paths.client-webapps}/**/#{app}/*.ls" when is-entry-point ..]

# Organize Tasks
gulp.task \default, ->
    if argv.clean is true
        console.log "Clearing build directory..."
        deleteFolderRecursive paths.build-folder
        return

    do function run-all
        gulp.start <[ browserify html vendor vendor-css assets pug ]>

    if only-compile
        console.log "Gulp will compile only once..."
        return

    watch pug-entry-files, ->
        gulp.start \pug

    watch "#{paths.vendor-folder}/**", (event) ->
        gulp.start <[ vendor vendor-css ]>


    for-browserify =
        "#{paths.client-webapps}/#{app}/**/*.ls"
        "#{paths.client-webapps}/#{app}/**/*.pug"
        "#{paths.client-src}/**/*.pug"
        "#{paths.client-src}/**/*.ls"

    watch for-browserify, ->
        gulp.start \browserify

# Copy js and html files as is
gulp.task \copy-js, ->
    gulp.src "#{paths.client-src}/**/*.js", {base: paths.client-src}
        .pipe gulp.dest paths.client-apps

gulp.task \html, ->
    base = "#{paths.client-webapps}"
    gulp.src "#{base}/**/*.html", {base: base}
        .pipe gulp.dest "#{paths.client-public}"



bundler = browserify do
    entries: ls-entry-files
    debug: true
    paths:
        paths.components-src
        paths.lib-src
        paths.client-webapps
    extensions: <[ .ls ]>
    #cache: {}
    #package-cache: {}
    plugin: [watchify unless only-compile]

bundler.transform \browserify-livescript
bundler.transform ractive-preparserify

function bundle
    bundler
        .bundle!
        .on \error, (err) ->
            on-error \browserify, err
            console.log "err stack: ", err.stack
            @emit \end
        .pipe source "public/#{app}.js"
        .pipe buffer!
        .pipe sourcemaps.init {+load-maps, +large-files}
        .pipe sourcemaps.write '.'
        .pipe gulp.dest './build'
        .pipe tap (file) ->
            log-info \browserify, "Browserify finished"

gulp.task \browserify, -> run-sequence \copy-js, ->
    bundle!

# Concatenate vendor javascript files into public/js/vendor.js
gulp.task \vendor, ->
    files = glob.sync "./vendor/**/*.js"
    gulp.src files
        .pipe tap (file) ->
            #console.log "VENDOR: ", file.path
        .pipe cat "vendor.js"
        .pipe gulp.dest "#{paths.client-apps}/js"

# Concatenate vendor css files into public/css/vendor.css
gulp.task \vendor-css, ->
    gulp.src "#{paths.vendor-folder}/**/*.css"
        .pipe cat "vendor.css"
        .pipe gulp.dest "#{paths.client-apps}/css"

# Copy assets into the public directory as is
gulp.task \assets, ->
    gulp.src "#{paths.client-src}/assets/**/*", {base: "#{paths.client-src}/assets"}
        .pipe gulp.dest paths.client-public

# Compile pug files in paths.client-src to the paths.client-tmp folder
gulp.task \pug ->
    gulp.src pug-entry-files
        .pipe tap (file) ->
            #console.log "pug: compiling file: ", path.basename file.path
        .pipe pug {pretty: yes}
        .on \error, (err) ->
            on-error \pug, err
            @emit \end
        .pipe flatten!
        .pipe gulp.dest paths.client-apps

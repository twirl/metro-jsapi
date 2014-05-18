var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    watch = require('gulp-watch');

var src = [ 'src/**/*.js' ];

gulp.task('debug', function () {
    return gulp.src(src)
        .pipe(concat('metro.debug.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('release', function () {
    return gulp.src(src)
        .pipe(uglify())
        .pipe(concat('metro.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('default', ['debug', 'release']);
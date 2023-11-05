var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser')


var wineRouter =  require('./routes/wineBot');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.papersToken));
app.use(express.json({limit:'10mb'}));
app.use(bodyParser.json({limit: '50mb'}))
bodyParser.json({limit: '50mb'})
app.use(express.static(path.join(__dirname, 'public')));


app.use('/wine/', wineRouter);
app.use('/igrik', require('./routes/igrikBot'));
app.use('/paper', require('./routes/papersBot'));
app.use('/auditoria', require('./routes/auditoriaBot'));
app.use('/sss', require('./routes/sss'));
app.use('/kaha', require('./routes/kaha'));
app.use('/wtg', require('./routes/wtgBot'));
app.use('/test', require('./routes/test'));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger =      require('morgan');
var bodyParser =  require('body-parser');
var requestLanguage = require('express-request-language');
var vhost = require('vhost');
var subdomain = require('express-subdomain');

const { devlog, alertMe } = require('./routes/common');

require('dotenv').config()


var app = express();

console.log(process.env.papersToken)

app.use(cookieParser(process.env.papersToken));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: false }));
app.use(requestLanguage({
  languages: [`ru-RU`,'en-EN'],
}));


app.use(express.json({limit:'10mb'}));
app.use(bodyParser.json({limit: '50mb'}))
bodyParser.json({limit: '50mb'})
app.use(express.static(path.join(__dirname, 'public')));


let auRouter = require('./routes/auditoriaBot')

// app.use('/wine/',       require('./routes/wineBot'));
app.use('/igrik',       require('./routes/igrikBot'));

app.use(require('./routes/papers/crons'));
app.use('/paper/slack',       require('./routes/papers/slack'));
app.use('/paper/admin',       require('./routes/papers/admin'));
app.use('/paper/api',         require('./routes/papers/api'));
app.use('/paper',             require('./routes/papersBot').router);


app.use(vhost(`papers.*.*`,require('./routes/papersBot').router));


app.use(vhost(`dimazvali.localhost`,require('./routes/dimazvali')))
app.use(vhost(`dimazvali.*.*`,require('./routes/dimazvali')))
app.use('/dimazvali',     require('./routes/dimazvali'));

app.use(vhost(`neva.localhost`,require('./routes/neva')))
app.use(vhost(`neva.*.*`,require('./routes/neva')))
app.use('/neva',       require('./routes/neva'));

app.use('/auditoria',           require('./routes/auditoriaBot'));
app.use(vhost(`auditoria.*.*`,  require('./routes/auditoriaBot')))
app.use(vhost(`au.localhost`,   require('./routes/auditoriaBot')))




// app.use('/sss',         require('./routes/sss'));
app.use('/kaha',        require('./routes/kaha'));
app.use('/wtg',         require('./routes/wtgBot'));
app.use('/test',        require('./routes/test'));
app.use('/cyprus',      require('./routes/cyprus'));
app.use('/ps',          require('./routes/psBot'));
app.use('/vz',          require('./routes/vzBot'));
app.use('/books',       require('./routes/booksBot'));

// app.use('/hz',              require('./routes/hz'));
app.use('/homeless',        require('./routes/homelessBot'));


// app.use(`/dash`,            require('./routes/dashBot'))
// app.use('/autoshell',       require('./routes/autoShellBot'));
// app.use('/stalker',       require('./routes/stalkerBot'));
// app.use('/reestr',       require('./routes/reestrBot'));


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

process.on('exit', function(code){ 
  return alertMe(`Exiting with code ${code}`); 
});


module.exports = app;
// Server-Timing header for every res.render: shows in DevTools → Network → Timing.
//   app    — request start → res.render (middleware, routes, data prep)
//   render — the pug render itself (compile too, when the view cache is off)
//   cache  — whether Express caches compiled views (desc="on"/"off")
// Compression runs after the headers are sent, so it isn't (and can't be) in here.
function ms(from, to) { return (Number(to - from) / 1e6).toFixed(1); }

function serverTiming(req, res, next) {
  var t0 = process.hrtime.bigint();
  var origRender = res.render;
  res.render = function(view, options, cb) {
    if (typeof options === 'function') { cb = options; options = undefined; }
    var tRender = process.hrtime.bigint();
    var self = this;
    return origRender.call(this, view, options, function(err, html) {
      if (!err && !self.headersSent) {
        var tDone = process.hrtime.bigint();
        self.setHeader('Server-Timing', [
          'app;dur=' + ms(t0, tRender),
          'render;dur=' + ms(tRender, tDone),
          'cache;desc="' + (req.app.enabled('view cache') ? 'on' : 'off') + '"',
        ].join(', '));
      }
      if (cb) return cb(err, html);
      if (err) return req.next(err);
      self.send(html);
    });
  };
  next();
}

module.exports = serverTiming;

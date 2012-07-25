
/**
* Module dependencies.
*/

var express = require('express');
var seqdb = require('./seqdb');
var os = require('os');

var app = module.exports = express.createServer();
var io = require('socket.io').listen(app);

// Configuration

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(require('stylus').middleware({src: __dirname + '/public'}));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.listen(8787);
});

app.configure('production', function(){
    app.use(express.errorHandler());
    app.listen(3000);
});

// fetch server ip adress
var platform = os.platform();
var interfaces = os.networkInterfaces();

if (platform === "linux"){
  var hostip = interfaces.eth0[0].address;
} else if (platform === "darwin"){
  var hostip = interfaces.en0[1].address;
}
console.log(hostip);

// Routes

app.get('/', function(req, res) {
    res.render('index', {
        title: 'Allelic Variation Explorer',
        hostip: hostip
    });
});

// socket.io
io.set('log level', 1);
io.sockets.on('connection', function(socket) {

    socket.on('getData', function(region) {
        seqdb.getRegion(region, function(err, data){
            if (err) {throw err;}
            if (data.refseq === "") {
              console.log("empty");
              socket.emit('featureNotFound',
              "region out of range!");
            } else {
              socket.emit('data', data);
            }
        });
    });
    
    socket.on('getFeatureRegion', function(req) {
        console.log(req);
        var genome = req.genome;
        var name = req.name;
        var flank = req.flank;
        seqdb.getFeatureRegion(genome, name, flank, function(err, reg) {
          console.log(reg);
            if (err) {console.log(err);}
            if (reg.start === undefined) {
                socket.emit('featureNotFound',
                "Feature has not been found");
            } else {socket.emit('featureRegion', reg);}
        });
    });

    socket.on('getStrains', function(genome) {
      seqdb.getAllStrains(genome, function(data) {
        socket.emit('strains', data);  
      });  
    });

    socket.on('getRefList', function() {
      seqdb.getRefList(function(data) {
        socket.emit('refList', data);  
      });    
    });

    socket.on('switchReference', function(refgen) {
      seqdb.switchDb(refgen);
    });

});

console.log("Express server listening on port %d in %s mode",
    app.address().port, app.settings.env);

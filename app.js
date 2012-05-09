
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
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

// fetch server ip adress

var interfaces = os.networkInterfaces();
var interface = interfaces.eth0 || interfaces.en0;
var hostip = interface[0].address;
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
        console.log(region);
        seqdb.getRegion(region, function(err, data){
            if (err) {throw err;}
            if (data.refseq === "") {
 
              console.log(data)
              console.log("empty");
              socket.emit('featureNotFound',
              "region out of range!");
            } else {
              socket.emit('data', data);
            }
        });
    });
    
    socket.on('getFeatureRegion', function(req) {
        var name = req.name;
        var flank = req.flank;
        seqdb.getFeatureRegion(name, flank, function(err, reg) {
            if (err) console.log(err);
            if (reg.start === undefined) {
                socket.emit('featureNotFound',
                "Feature has not been found");
            } else socket.emit('featureRegion', reg);
        });
    });

    socket.on('getStrains', function() {
      seqdb.getAllStrains(function(data) {
        socket.emit('strains', data);  
      })  
    });

    socket.on('getRefList', function() {
      seqdb.getRefList(function(data) {
        socket.emit('refList', data);  
      })    
    });

    socket.on('switchReference', function(refgen) {
      seqdb.switchDb(refgen);
    });

});

app.listen(3000);
console.log("Express server listening on port %d in %s mode",
    app.address().port, app.settings.env);

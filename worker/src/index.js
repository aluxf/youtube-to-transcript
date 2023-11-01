const express = require('express');
const app = express();
const port = 3000;
const server = require('http').createServer(app);
const os = require('os');

const MAXTHREADS = process.env.MAXTHREADS || 10;
const TextManager = require('./textManager');
const ActiveSearchStrategy = require('./searchStrategyBuilder')();

// Express setup
// --------------------
var router = express.Router();
router.get('/:textTitle/:searchString', startSearch);
router.post('/add', addVideo);
app.use('/', router);

// Here's the core of the poodle
// --------------------
function startSearch(req, res) {
    if (!req.params.searchString) return res.send('EMPTY');
    let title = req.params.textTitle.replaceAll('+', ' ').trim();
    let searchTerm = req.params.searchString.replaceAll('+', ' ').trim();
    let textManager = new TextManager();
    let textSearcher = new ActiveSearchStrategy();
    console.log('Searching in', title, 'for:', searchTerm);
    return textManager.connect()
        .then( () => textManager.startSearch( {searchString: searchTerm, textTitle: title}, MAXTHREADS, textSearcher) )
        .then( result => result.flat().map( r => { return { textTitle: title,
                                                            contents: r.replace(/[\n\r]/g, ' ').trim()};}))
        .then( r => { console.log('Number of results:',r.length); return r; })
        .then( cleaned => res.send(cleaned) );
}

function addVideo(req, res) {
    return;
}

// Simple error handling
// --------------------
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    console.log('Page not found: ' + req.url);
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if ('/favicon.ico' != req.url) {        
        let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        console.log('Error %d, remoteAddress: %s', err.status, ip);
        console.log('If running inside Vagrant, this may give some clues to the callers identity:');
        console.log(req.ip);
        console.log(req.ips);
        console.log(req.hostname);
        console.log(req.headers);   
    }     
    
    // render the error page
    res.status(err.status || 500);
    res.send('error');
});


// All done, start listening
server.listen(port, () => {
    console.log(`QuoteFinder Worker listening on port ${port}`);
    console.log('Server id:', os.hostname());
});



console.log('Worker started...');

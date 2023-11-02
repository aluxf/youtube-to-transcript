const express = require('express');
const app = express();
const port = 3000;
const server = require('http').createServer(app);
const os = require('os');
const fs = require('fs');


const MAXTHREADS = process.env.MAXTHREADS || 10;
const TextManager = require('./textManager');
const ActiveSearchStrategy = require('./searchStrategyBuilder')();
const YOUTUBE_API_ENDPOINT = (id) => `https://youtube-mp36.p.rapidapi.com/dl?id=${id}`;


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

/**
 * 
 * data = {
 *  title: example
 *  url: youtube.com/example
 * }
 * 
 * 1. title url
 * 2. download youtube mp3 from url
 * 3. send to whisper
 * 4. get transcript
 * 5. add to database
 */



async function addVideo(req, res) {

    /*const {title, url, ..._} = req.body;

    const youtubeVideoId = ""
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '2547961a8emsh411ef67f690eb0ep1833e0jsn5e6d005ff2f6',
            'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
        }
    };

    //get mp3
    try {
        const response = await fetch(YOUTUBE_API_ENDPOINT(id), options);
        const result = await response.text();
        console.log(result);
    } catch (error) {
        console.error(error);
    }

    //mp3 download
    /*fetch(url)
    .then(res => {
        if (!res.ok) {
        throw new Error(`unexpected response ${res.statusText}`);
        }
        const dest = fs.createWriteStream(outputPath);
        res.body.pipe(dest);
    })
    .catch(err => {
        console.error('Error downloading file:', err);
    });*/

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

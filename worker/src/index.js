const express = require('express');
const app = express();
const port = 3000;
const server = require('http').createServer(app);
const os = require('os');
const fs = require('fs');
const url = require("url");
const {pipeline} = require("stream")
const {promisify} = require("util")
const OpenAI = require("openai")

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY 
})

const pipelineAsync = promisify(pipeline)

const MAXTHREADS = process.env.MAXTHREADS || 10;
const TextManager = require('./textManager');
const { error } = require('console');
const ActiveSearchStrategy = require('./searchStrategyBuilder')();
const YOUTUBE_API_ENDPOINT = (id) => `https://youtube-mp36.p.rapidapi.com/dl?id=${id}`;

// Express setup
// --------------------
var router = express.Router();
router.get('/:textTitle/:searchString', startSearch);
router.post('/add', addVideo);
app.use(express.json());
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

async function downloadMp3(url, output) {
    return await fetch(url)
    .then(async res => {
        const fileStream = fs.createWriteStream(output)
        await pipelineAsync(res.body, fileStream)
        console.log(`MP3 file downloaded successfully to ${output}`);
    })
    .catch(err => {
        console.error("Failed to download mp3:", error)
        fs.unlink(output, (unlinkError) => {
            if (unlinkError) console.error('Failed to delete the partial file:', unlinkError);
        });
        throw err
    })
}

async function transcribe(file) {
    const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(file),
        model: "whisper-1"
    })
    return response.text;
}

async function addVideo(req, res) {
    let title = ""
    let transcript = ""
    let url = ""
    try {
        title = req.body.title
        url = req.body.url
    }
    catch (err) {
        console.log(err)
        return res.status(500).send("Invalid body.")
    }

    const parsedUrl = new URL(url);
    const id = parsedUrl.searchParams.get("v");
    
    //YouTube to MP3
    const maxAttempts = 5
    let attempt = 0
    let mp3Link = "";
    while(attempt < maxAttempts && !mp3Link) {
        try {
            const response = await fetch(YOUTUBE_API_ENDPOINT(id), {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': '2547961a8emsh411ef67f690eb0ep1833e0jsn5e6d005ff2f6',
                    'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
                }
            });
            const result = await response.json();
            console.log(result);
            if (!result.link) {
                await new Promise(resolve => setTimeout(resolve, 2000))
                attempt++;
                continue;
            }
            mp3Link = result.link;

            break;
        } catch (error) {
            console.error(error);
            return res.status(500).send("Error occurred while fetching video")
        }
    }

    // Download MP3
    const fileOutput = `${id}.mp3`
    console.log(mp3Link)
    await downloadMp3(mp3Link, fileOutput)
    .catch(err => {
        console.error(err)
        return res.status(500).send("Error occurred while downloading mp3")
    })

    transcript = await transcribe(fileOutput)
    
    const tm = new TextManager()
    return tm.connect()
    .then(() => tm.addText(title, transcript))
    .then(() => res.status(200).send("Video transcript added."))
    .catch((err) => {
        console.error(err)
        res.status(500).send("Error occurred while adding video.")
    })
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

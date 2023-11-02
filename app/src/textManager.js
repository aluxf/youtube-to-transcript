var mongoose = require('mongoose');
var dbServer = '127.0.0.1:27017';
const dbPort = '27017';
const dbName = 'textStore';
var Text = require('./textStore');

const CHUNKSIZE = 1000; // number of lines per chunk

class TextManager {    
    constructor() {
    }

    connect() {
        if (!process.env.TEXTSTORE_HOST) {
            console.log('WARNING: the environment variable TEXTSTORE_HOST is not set');        
        } else {
            dbServer = process.env.TEXTSTORE_HOST + ':' + dbPort;
        }

        let connection = `mongodb://${dbServer}/${dbName}`
        return mongoose.connect(connection)
            //.then( () => console.log('Connected to database', dbName))
            .catch( (err) => {
                console.error('Database connection error', dbName);
                console.error(' trying to connect to server:', connection);
            });
    }

    testSearch() {
        let testJob= {searchString: 'test', textTitle: 'testText', returnQueue: null, };        
        return this.startSearch(testJob, 5, (t) => t);
    }

    //TODO: title already in use handling
    async addText(title, contents) {
        console.log(title)
        const textExists = await Text.findOne({name: title})
        .then((doc) => {
            return doc !== null;
        });


        if (textExists) {
            console.log("Title already in use.");
            return;
        }

        contents = contents || '';
        //console.log('Storing text to database');
        let lines = contents.split(/\n/);
        let firstLine = 0;
        let lastLine = firstLine + CHUNKSIZE;

        const textChunks = [];
        while (firstLine <= lines.length) {

            let chunk = lines.slice(firstLine, lastLine+1).join('\n');
            textChunks.push({
                name: title,
                startLine: firstLine,
                contents: chunk
            });
            firstLine=lastLine+1;
            lastLine=firstLine + CHUNKSIZE;
        }
        console.log(textChunks)
        await Text.insertMany(textChunks)
        .catch((err) => console.error('Error while inserting text: ', err.message))
    }
    
    listTexts() {
        //console.log('Retrieving available text titles...');
        return Text.distinct('name');
    }

    _populateTestText() {
        console.log('Adding a test entry to the database.');
        return new Text({name:'testText', startLine: 0, contents: 'test'})
            .save()
            .catch(err => console.log('Error while inserting test text:', err.message));
    }

    _runSearch(job, batch, searchStrategy) {
        return Promise.resolve(batch)
        .then( batch => {
            let results = [];
            batch.forEach( doc => {
                results.push(searchStrategy.search(job.searchString, doc.contents));
            });

            return results;
        });
    }

    _flattenResults(resultsMatrix) {
        return resultsMatrix.flat().filter(e => (Array.isArray(e) && (0 < e.length)) );
    }    
}

module.exports = TextManager;

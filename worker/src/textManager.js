var mongoose = require('mongoose');
var dbServer = '127.0.0.1:27017';
const dbPort = '27017';
const dbName = 'textStore';
var {VideoTranscript, Text } = require('./textStore');

const CHUNKSIZE = 1000; // number of lines per chunk

class TextManager {    
    constructor() {
        console.log("tm")
    }

    connect() {
        console.log("CONNNEEEECT")
        if (!process.env.TEXTSTORE_HOST) {
            console.log('WARNING: the environment variable TEXTSTORE_HOST is not set');        
        } else {
            dbServer = process.env.TEXTSTORE_HOST + ':' + dbPort;
        }

        let connection = `mongodb://${dbServer}/${dbName}`
        return mongoose.connect(connection)
            .then(() => this.ensureTextIndex())
            //.then( () => console.log('Connected to database', dbName))
            .catch( (err) => {
                console.error('Database connection error', dbName);
                console.error(' trying to connect to server:', connection);
            });
    }

    ensureTextIndex() {
        VideoTranscript.collection.createIndex({ title: 'text' }, { unique: false })
          .then(() => {
            console.log('Text index verified or created on textFieldName');
          })
          .catch((err) => {
            // If the error is because the index already exists, we can ignore it
            if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
              console.log('Text index already exists on textFieldName');
            } else {
              // If it's some other error, it should be handled or logged
              console.error('Error creating text index:', err.message);
            }
          });
      }

    async startSearch(title) {
        try {
          // We'll first perform a text search on VideoTranscripts with the matching title.
          const searchResults = await VideoTranscript.find({
            $text: { $search: title }
          }).exec();
    
          // Now for each VideoTranscript, we find and aggregate the related Text documents.
          const fullTextPromises = searchResults.map(videoTranscript =>
            Text.find({ videoTranscript: videoTranscript._id })
              .sort('index') // Assuming 'index' orders the Text chunks correctly.
              .then(texts => texts.map(t => t.contents).join(' '))
              .then(fullText => ({
                videoTranscript: videoTranscript,
                fullText: fullText
              }))
          );
    
          // Resolve all promises to get an array of objects containing VideoTranscript and full text.
          return Promise.all(fullTextPromises);
        } catch (err) {
          console.error('Error during search: ', err.message);
          throw err;  // Rethrow the error to be handled by the caller
        }
      }

    //TODO: title already in use handling
    async addText(title, url, contents) {
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
        let index  = 0

        const textChunks = [];

        const videoTranscript = new VideoTranscript({
            title: title,
            url: url
        });
    
        const newVideo = await videoTranscript.save();
        let firstLine = 0
        let lastLine=firstLine + CHUNKSIZE;

        while (firstLine <= lines.length) {

            let chunk = lines.slice(firstLine, lastLine+1).join('\n');
            textChunks.push({
                name: title,
                index: index,
                contents: chunk,
                videoTranscript: newVideo._id
            });
            firstLine=lastLine+1;
            lastLine=firstLine + CHUNKSIZE;
            index++;
        }
        console.log(textChunks)
        await Text.insertMany(textChunks)
        .catch((err) => console.error('Error while inserting text: ', err.message))
    }
    
    
}

module.exports = TextManager;

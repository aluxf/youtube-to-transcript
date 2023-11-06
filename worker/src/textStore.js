var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var videoTranscriptSchema = new Schema({
    title: String,
    url: String
})

var textStoreSchema = new Schema({
    name : String,
    index : Number,
    contents : String,
    videoTranscript: {
        type: Schema.Types.ObjectId,
        ref: "videoTranscript"
    }
});

module.exports = {
    VideoTranscript: mongoose.model('videoTranscript', videoTranscriptSchema),
    Text: mongoose.model('textStore', textStoreSchema)
}

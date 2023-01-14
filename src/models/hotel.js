const mongoose = require('mongoose');
const Review = require('./review');

const hotelSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        min: [0, 'Price cannot be negative'],
        required: true
    },
    text: {
        type: String,
        min: 1,
        max: 1000,
        required: false
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    user: String
});

hotelSchema.post('findOneAndDelete', async (hotel)=>{
    if(hotel.reviews.length){
        let res = await Review.deleteMany({_id: {$in: hotel.reviews}});
    }
});

const Hotel = mongoose.model('Hotel', hotelSchema);

module.exports = Hotel;

const express = require('express');
const app = express();
const path = require('path');
const method_override = require('method-override');
const mongoose = require('mongoose');
const Hotel = require('./models/hotel');
const AppError = require('./views/appError');
const Joi = require('joi');
const Review = require('./models/review');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const localStrategy = require('passport-local');
const User = require('./models/user');
const cookieParser = require('cookie-parser');
let year = new Date().getFullYear();

const validateHotel = (req, res, next) => {
    let schema = Joi.object({
    title: Joi.string().min(1).max(40).required(),
    location: Joi.string().min(1).required(),
    image: Joi.string().required(),
    price: Joi.number().min(1).max(9999).required(),
    text: Joi.string().min(1).max(1000).required()
    }).required();
    let result = schema.validate(req.body);
    if(result.error){
        let message = result.error.details.map(el => el.message).join(', ');
        req.flash('error', message);
        res.redirect('/add');
    }
    else{
        next();
    }
};

mongoose.connect('mongodb://localhost:27017/hotelsApp')
.then(()=>{
    console.log('Connected to mongo!');
})
.catch((e)=>{
    console.log('Error', e);
});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(express.static(__dirname + '/assets'));
app.use(express.urlencoded({extended: true}));
app.use(method_override('_method'));
app.use(cookieParser());
app.use(session({secret: 'regularsecret'}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next)=>{
    res.locals.year = year;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
});

app.get('/', (req, res)=>{
    res.render('index');
});

app.get('/register', (req, res)=>{
    res.render('regster');
});

app.post('/register', async (req, res)=>{
    try{
    const {email, username, password} = req.body;
    const user = new User({email, username});
    const registeredUser = await User.register(user, password);
    req.login(user, function(err) {
    if (err) { return next(err); }
    req.flash('success', `Welcome to our page, ${username}!`);
    res.redirect('/');
    });
    }
    catch(e){
        req.flash('error', e.message);
        res.redirect('/register');
    }
});

app.get('/login', (req, res)=>{
    res.render('lgn');
});

app.post('/login', passport.authenticate('local', {failureFlash:true, failureRedirect: '/login'}), (req, res)=>{
    req.flash('success', 'Welcome back!');
    res.redirect('/');
});

app.post('/logout', (req, res, next)=>{
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success', 'Goodbye!');
    res.redirect('/');
  });
});


app.get('/add', (req, res)=>{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged in');
        res.redirect('/');
    }
    res.render('add');
});

app.get('/browse', async (req, res, next)=>{
    try{
    let hotels = await Hotel.find({});
    res.render('browse', {hotels});
    }
    catch(e){
        next(e);
    }
});

app.post('/browse', validateHotel, async (req, res, next)=>{
    try{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged in to post!');
        res.redirect('/');
    }
    let newHotel = new Hotel(req.body);
    newHotel.user = req.user.username;
    await newHotel.save();
    req.flash('success', 'You have added a new hotel!');
    res.redirect('/browse');
    }
    catch(e){
        next(e);
    }
});

app.get('/browse/:id', async (req, res, next)=>{
    try{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged in!');
        res.redirect('/');
    }
    const {id} = req.params;
    let hotel = await Hotel.findById(id).populate('reviews');
    res.render('show', {hotel});
    }
    catch(e){
        next(e);
    }
});

app.get('/browse/:id/edit', async (req, res, next)=>{
    try{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged in!');
        res.redirect('/');
    }
    const {id} = req.params;
    let hotel = await Hotel.findById(id);
    res.render('edit', {hotel});
    }
    catch(e){
        next(e);
    }
});

app.patch('/browse/:id', async (req, res, next)=>{
    try{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged in!');
        res.redirect('/');
    }
    const {id} = req.params;
    await Hotel.findByIdAndUpdate(id, req.body);
    req.flash('success', 'Edited a hotel!');
    res.redirect(`/browse/${id}`);
    }
    catch(e){
        next(e);
    }
});

app.delete('/browse/:id', async (req, res, next)=>{
    try{
    const {id} = req.params;
    let hotel = await Hotel.findById(id);
    if(req.user.username !== hotel.user){
        req.flash('error', 'Cannot delete!');
        return res.redirect('/browse');
    }
    await Hotel.findByIdAndDelete(id);
    req.flash('success', 'Deleted a hotel!');
    res.redirect('/browse');
    }
    catch(e){
        next(e);
    }
});

app.post('/browse/:id/reviews', async (req, res, next)=>{
    try{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged-in to post!');
        res.redirect('/');
    }
    let {id} = req.params;
    let schema = Joi.object({
        text: Joi.string().min(1).max(350).required()
    }).required();
    let result = schema.validate(req.body);
    if(result.error){
        let message = result.error.details.map(el => el.message).join(', ');
        req.flash('error', message);
        return res.redirect(`/browse/${id}`);
    }
    let hotel = await Hotel.findById(id);
    if(hotel.user === req.user.username){
        req.flash('error', "Cannot review your own hotel (that's cheating)");
        return res.redirect(`/browse/${id}`);
    }
    let review = new Review({text: req.body.text, user: req.user.username});
    hotel.reviews.push(review);
    await review.save();
    await hotel.save();
    req.flash('success', 'Added a review!');
    res.redirect(`/browse/${id}`);
    }
    catch(e){
        next(e);
    }
});

app.delete('/browse/:id/reviews/:review_id', async (req, res)=>{
    if(!req.isAuthenticated()){
        req.flash('error', 'You must be logged-in to delete!');
        res.redirect('/');
    }
    let {id, review_id} = req.params;
    await Hotel.findByIdAndUpdate(id, {$pull: {reviews: review_id}});
    await Review.findByIdAndDelete(review_id);
    req.flash('success', 'Deleted a review!');
    res.redirect(`/browse/${id}`);
});

app.all('*', (req, res, next)=>{
    next(new AppError('Not found', 404));
});

app.use((err, req, res, next)=>{
    let {status = 500, message = 'Unknown error'} = err;
    if(status === 404){
    res.render('error', {status, message});
    } else {
        req.flash('error', message);
        res.redirect('/');
    }
});

app.listen(3000, ()=>{
    console.log('Start server 3000!');
});




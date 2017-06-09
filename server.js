/* Showing Mongoose's "Populated" Method (18.3.8)
 * INSTRUCTOR ONLY
 * =============================================== */

// Dependencies
var express = require("express");
var exphbs = require ("express-handlebars")
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
// Requiring our Note and Article models
var Note = require("./models/note.js");
var Article = require("./models/article.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;


// Initialize Express
var app = express();

// Set Handlebars as new engine
app.engine("handlebars", exphbs({ defaultLayout: "main"}));
app.set("view engine", "handlebars");

// Use body parser with our app
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose
mongoose.connect("mongodb://localhost/mongoScraper");
var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function() {
  console.log("Mongoose connection successful.");
});


// Routes
// ======

app.get("/", function (req, res) {
  res.render("index")
});

app.get('/scrape', function(req, res) {

  // First, grab the body of the html with request
  request('https://food52.com/recipes', function(error, response, html) {

    var $ = cheerio.load(html);

    $('div.collectable-tile').each(function(i, element) {
        var result = {};

        result.title = $(this).children('h3').children('a').attr('title'); 
        result.link = 'https://food52.com' + $(this).children('h3').children('a').attr('href');
        result.summary = $(this).children('h3').children('div.meta').children('a').text();
        result.image = $(this).children('div.photo-block').children('a').children('img.quick-basket-img').attr('src');
          
            Article.count({ title: result.title}, function (err, test){

                // Using the Article model, create a new entry (note that the "result" object has the exact same key-value pairs of the model)
                var newarticle = new Article (result);
                newarticle.save(function(err, doc) {
                  console.log(doc);
                });
            });
    });
  // Tell the user that we finished scraping Reddit
  res.render("scrapeComplete", {title: "Title Of Site"});
  });
});

// A GET request to scrape the echojs website
//Scraping
// app.get('/scrape', function(req, res) {

//   // First, grab the body of the html with request
//   request('http://www.lakersnation.com/', function(error, response, html) {

//     var $ = cheerio.load(html);

//     $('div.item-details').each(function(i, element) {
//         var result = {};
//         result.title = $(this).children('h3').children('a').attr('title').trim(); 
//         result.link = $(this).children('h3').children('a').attr('href').trim();
//         result.summary = $(this).children('div.td-excerpt').text().trim() + ""; 
//         result.image = $(this).parent('div').children('div.td-module-thumb').children('a').children('img').attr('src');
//         console.log(result.image);        
//             Article.count({ title: result.title}, function (err, test){

//                 // Using the Article model, create a new entry (note that the "result" object has the exact same key-value pairs of the model)
//                 var newarticle = new Article (result);
//                 newarticle.save(function(err, doc) {
//                   console.log(doc);
//                 });
//             });
//     });
//   // Tell the user that we finished scraping Reddit
//   res.render("scrapeComplete", {title: "Title Of Site"});
//   });
// });

// This will get the articles we scraped from the mongoDB
app.get("/articles", function(req, res) {
  // Grab every doc in the Articles array
  Article.find({}, function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Or send the doc to the browser as a json object
    else {
      
      res.render('articles', {
        //'articles is var looped over in articles.handlebars'
        articles:doc

      });
    }
  });
});

//Grabbing individual articles for comments
app.get('/articles/:id', function(req, res) {
  Article.findOne({'_id': req.params.id})
    //Grabs joined comments
    .populate('notes')
    .exec(function(err, doc) {
      //consoles error if any
      if (err) {
        console.log(err);
      }
      //Else renders comments handlebars
      else {
        res.render('notes', {
          //Utilizes article as the variable that is looped over each instance of comments for a particular article to display all comments
          article: doc
        });
      }
  });
});

//Post new comments
// app.post('/articles/:id', function(req, res)  {
//   var newNote = new Note(req.body);

//   //Saves new comment via Mongoose
//   newNote.save( function(err, doc) {
//     //If error, console log error
//     if (err) {
//       console.log(err);
//       //Else updates article with id :id to include a new comment with same id
//     } else {
//       var articleId = req.params.id;
//       Article.findOneAndUpdate({'_id': articleId}, {'notes': doc._id})
//         .exec( function(err, doc)  {
//           if (err) {
//             console.log(err);
//           } else {
//             //Redirects to the specific article's comment page
//             res.redirect('/articles/' + articleId);
//           }
//         });
//     }
//   });
// });


app.post('/articles/:id', function(req, res) {

    var newNote = new Note(req.body);

    newNote.save(function(error, doc) {
      if(error) {
        console.log(error);
      } else {

        Article.findOneAndUpdate({ "_id": req.params.id }, { $push: {"notes": doc._id} }, {new: true}, function(err, newdoc) {
          if (err) {
            res.send(err);
          } else {
            res.redirect('/articles/' + req.params.id);
          }
        });
      }
    });
  });



//Get route to display saved articles
app.get('/saved', function(req, res)  {
  //Finds articles where saved is true
  Article.find({ 'saved' : true }, function(err, doc) {
    if (err) {
      console.log(err);
    }  else {
      //Renders saved articles handlebars
      res.render('saved', {
        articles: doc
      });
    }
  })
});

//Setting route to update an article to saved = true if user clicks "save article"
app.post('/saved/:id', function(req, res)  {
  Article.update({ '_id' : req.params.id }, { $set : { 'saved' : true }}, function(err, doc) {
  res.redirect('/articles');
})
}); 

//Unsaves article
app.post('/unsaved/:id', function(req, res) {
  //Updates article with parametre _id by setting parameter saved to false
  Article.update( { '_id' : req.params.id }, { $set : { 'saved' : false }}, function(err, doc) {
  //Redirects to saved articles
  res.redirect('/saved');
});
});



// Listen on port 3000
app.listen(2020, function() {
  console.log("App running on port 2020!");
});
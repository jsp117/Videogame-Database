// Requiring our models and passport as we've configured it
var db = require("../models");
var passport = require("../config/passport");
const axios = require("axios");
var games = "";
var token = "";
// var getToken = "./authorization.js";
module.exports = function (app) {

  // passport.authenticate checks if a user is logged in with valid credentials before allowing them to access certain pages
  // login route - gets access token
  app.post("/api/login", passport.authenticate("local"), function (req, res) {
    axios
      .post(
        "https://id.twitch.tv/oauth2/token?client_id=qh6jfouob87senzmm6422jomq4ui44&client_secret=83qdp141qoaog5ybcmwpr4z7u6wj4y&grant_type=client_credentials"
      )
      .then(
        function (response) {
          token = response.data.access_token;
        }
      )
      .then(function () {
        db.User.update(
          { access: token },
          {
            where: {
              id: req.user.dataValues.id,
            },
          }
        );
        res.json(req.user);
      })
  });

  //  sign up route
  app.post("/api/signup", function (req, res) {
    db.User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      birthday: req.body.birthday,
    })
      .then(function () {
        // redirect to login page
        res.redirect(307, "/api/login");
      })
      .catch(function (err) {
        // throw error status 401
        res.status(401).json(err);
      });
  });

  // Route for logging user out
  app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
  });

  // Route for getting favorite game data and user info
  app.get("/api/user_data", async function (req, res) {
    if (!req.user) {
      res.json({});
    } else {
      db.User.findOne({ where: { id: req.user.id } })
        .then(function (data) {
          db.Games.findAll({ where: { userId: req.user.id } }).then(function (display) {
            // console.log("all games: ", display);
            if (!data.dataValues.image_url) {
              res.json({
                display: display,
                email: req.user.email,
                bio: data.dataValues.bio
              });
            } else {
              res.json({
                display: display,
                email: req.user.email,
                bio: data.dataValues.bio,
                image: data.dataValues.image_url
              });
            }
          });
        });
    }
  });

  // search function - query igdb for games with user input
  app.post("/search", async function (req, res) {
    games = await axios({
      url: `https://api.igdb.com/v4/games/?search=${req.body.search}&fields=id,name,collection,genres,cover.url,first_release_date,rating,slug,storyline,summary`,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": "qh6jfouob87senzmm6422jomq4ui44",
        Authorization: `Bearer ${token}`,
      },
      // data: "fields= *;"
    })
      .then((response) => {
        // console.log("first search responses ", response.data);
        games = response.data;
        // console.log("first id", games[0].cover);
        // console.log("games NEW", games);
        return games;
      })
      .catch((err) => {
        res.send(err);
      });

    res.json({
      // pass data email/id
      games: JSON.stringify(games),
    });
  });

  // displays games on search page
  app.get("/api/search", async function (req, res) {
    // console.log("searched games: ", games);
    res.json({
      display: games,
    });
  });

  var addFriend = false;
  // add friends - database table friends
  app.post("/api/addfriend", function (req, res) {
    addfriend = false;
    db.Friends.findAll({ where: { user_Id: req.user.id }, raw: true })
      .then(function (data) {
        // console.log("check friend response", data);
        let friendArr = data.map(friend => friend.email);
        if (friendArr.includes(req.body.email)) {

          return res.status(406).send("You are already friends with this user");
        } else {
          addFriend = true;
        }
      }).then(function () {
        if (addFriend) {
          db.User.findOne({
            // grab email from modal
            where: { email: req.body.email },
          }).then(function (friend) {
            db.Friends.create({
              user_Id: req.user.id,
              email: friend.dataValues.email,
              friend_id: friend.dataValues.id,
            });
            db.Friends.create({
              user_Id: friend.dataValues.id,
              email: req.user.email,
              friend_id: req.user.id,
            });
            if (friend.dataValues.email) {
              res.status(201).send("success!");
            }
          });
        }
      })
  });

  // add favorited games to database - table games
  app.post("/favorite", function (req, res) {
    // console.log("user", req.user);
    // console.log("game on backend", req.body.game);
    var game = req.body.game;
    var image = req.body.image;
    if (game.storyline) {
      var story = game.storyline;
    } else {
      story = "Not Available";
    }
    if (game.rating) {
      var rating = Math.floor(game.rating);
    }
    // console.log("rating", rating);
    if (game.first_release_date) {
      var ogdate = game.first_release_date;
      // console.log("ogdate: ", ogdate);
      var a = new Date(ogdate * 1000);
      var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var final = date + " " + month + " " + year + " ";
    }
    // console.log("release date", final);
    db.Games.create({
      userId: req.user.id,
      name: game.name,
      cover_url: image,
      user_rating: rating,
      year: final,
      storyline: story,
      summary: game.summary,
    }).then(function (data) {
      // console.log("returned data: ", data);
      if (!data) {
        res.status(406).send("Connection Issue");
      } else {
        res.status(201).send("Success!");
      }
    });
  });

  // get recommended games
  var recoGames = [];
  app.get("/api/recommended", function (req, res) {
    recoGames.length = 0;
    db.Reco.findAll({ where: { recommendee_id: req.user.id } }).then(function (data) {
      // console.log("recommended games: ", data);
      // console.log("datavalues: ", data[0].dataValues.game_id);
      // console.log("datavalues length", data.length);
      for (let i = 0; i < data.length; i++) {
        recoGames.push(data[i].dataValues.game_id);
      }
      db.Games.findAll({ where: { id: recoGames } })
        .then(function (game) {
          // console.log("recgame info", game);
          res.json({
            display: game
          })
        });
    })
  });

  var create = false;
  var find = false;

  // recommend games
  app.post("/api/recommend", function (req, res) {
    create = false;
    find = false;
    var rec = req.body.gameId;
    var email = req.body.email;
    // raw sets return value to normal javascript object
    db.Friends.findAll({ where: { user_id: req.user.id }, raw: true })
      .then(function (data) {
        // console.log("friends search", data);
        // console.log("datavalues", data.datavalues);
        let friendArr = data.map(friend => friend.email);
        // console.log("friend array", friendArr);
        // console.log("friend email", email);
        if (!friendArr.includes(email)) {
          // console.log("not your friend");
          // 
          return res.status(406).send("This person is not your friend");
        } else {
          find = true;
        }
      }).then(function () {
        if (find) {
          db.User.findOne({ where: { email: email } })
            // fix spelling recommendee
            .then(function (users) {
              var recId = users.dataValues.id;
              db.Reco.findAll({ where: { game_id: req.body.gameId, recommendee_id: recId }, raw: true })
                .then(function (game) {
                  // console.log("reco game response: ", game)
                  // check if returned array is empty, then create rec
                  if (game.length === 0) {
                    create = true;
                  } else {
                    return res.status(406).send("Recommendation already exists");
                  }

                }).then(function () {
                  if (create) {
                    db.Reco.create({
                      game_id: rec,
                      recommender_id: req.user.id,
                      recommendee_id: recId,
                    }).then(function (user) {
                      // console.log("returned data: ", data);
                      if (!user) {
                        res.status(406).send("Connection Issue");
                      } else {
                        res.status(201).send("Success!");
                      }
                    })
                  }
                });
            });
        }
      });
  });

  // edit profile
  app.post("/api/editprofile", function (req, res) {
    if (req.body.image && !req.body.bio) {
      db.User.update({ image_url: req.body.image }, { where: { id: req.user.id } })
        .then(function () {
          res.status(201).send("Success!");
        });
    }
    else if (req.body.bio && !req.body.image) {
      db.User.update({ bio: req.body.bio }, { where: { id: req.user.id } })
        .then(function () {
          res.status(201).send("Success!");
        });
    } else {
      db.User.update({ image_url: req.body.image, bio: req.body.bio }, { where: { id: req.user.id } })
        .then(function () {
          res.status(201).send("Success!");
        });
    }

  });

  // delete recommended game
  app.post("/api/deleteRec", function (req, res) {
    db.Reco.destroy({ where: { game_id: req.body.game.id, recommendee_id: req.user.id } })
      .then(function () {
        res.status(201).send("Success!");
      })
  });

  // delete favorited game
  app.post("/api/delete", function (req, res) {
    db.Games.destroy({ where: { id: req.body.game.id } })
      .then(function () {
        res.status(201).send("Success!");
      })
  });

  // include statement almost working include: [{model: db.User, as: 'host'}]
  app.get("/api/friends", function (req, res) {
    // console.log(req.user.id);
    db.Friends.findAll({ where: { user_Id: req.user.id } }).then(function (data) {
      // console.log("friends response", data);
      res.json({
        friends: data,
      });
    });
  });
};

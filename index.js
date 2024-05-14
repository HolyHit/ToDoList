import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import pg from "pg";
import bcrypt from "bcrypt";

import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";


//Express Setup
const app = express();
const port = 3000;

//bcrypt
const saltRounds = 10;

//cookies
//var isLoggedIn = false;
app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

//database connection
const db = new pg.Client({
    user: "admin",
    host: "localhost",
    database: "todolistproject",
    password: "admin",
    port: 5432,
  });
db.connect();

//Test Variables
let items = [
  { id: 1, item: "Not", user_id: 1 },
  { id: 2, item: "Working", user_id: 1 },
];

let user = {
  id: 69, username: 'notworking@notworking.com', password: 'What password'
};


//middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(express.static(__dirname + "/node_modules/bootstrap/dist"));

app.use(passport.initialize());
app.use(passport.session());

//functions
async function getToDoList(){
 const result = await db.query("SELECT * FROM todoitems WHERE user_id = $1 ", [user.id]);
 items = result.rows;
};

async function addItem(item, userId){
  await db.query("INSERT INTO todoitems (item, user_id) VALUES ($1, $2)", [item, userId]);
}


//GET routes
app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/todo');
  } else {
    res.render("index.ejs");
  }

 });

 app.get("/todo", async (req, res) => {
  if (req.isAuthenticated()) {
    await getToDoList();
    console.log("Rendering todo.ejss")
    res.render("todo.ejs", {
      currentUser: user.username,
      listItems: items,
    });
  } else {
    res.redirect("/");
  }
});


//POST routes
app.post("/login", 
  passport.authenticate("local", {
  successRedirect: "/todo",
  failureRedirect: "/",
}));

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/todo");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});



app.post("/add", async (req, res) => {
  await addItem(req.body.newItem, user.id);
  res.redirect("/todo");
});

app.post("/delete", async (req, res) => {
  const id = req.body.deleteItemId;
  await db.query("DELETE FROM todoitems WHERE id = $1", [id])

  res.redirect("/todo");
});

app.post("/logout", async (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
})


app.post("/check", async (req, res) => {
  const id = req.body.crossItemId;
  let isDone = true;

  if (req.body.crossItemIsCrossed === 'true') {
    isDone = true;
  } else if (req.body.crossItemIsCrossed === 'false') {
    isDone = false;
  }

  await db.query("UPDATE todoitems SET isdone = $1 WHERE id = $2;", [!isDone, id])
});

app.post("/uncheck", async (req, res) => {
  console.dir("Unchecking" + req.body);
})


//Login functionality

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        user = result.rows[0];

        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              console.log('Password check');
              console.log(user);
              return cb(null, user);
            } else {
              console.log('No password check');
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        console.log('No user');
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);


passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

//What port

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  
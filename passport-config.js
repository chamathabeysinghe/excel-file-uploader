const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user.model');

function initialize(passport) {
  const authenticateUser = async (username, password, done) => {
    try {
      let user;

      // Check if the user is the default admin
      if (username === 'admin@admin.com') {
        // Hardcoded default admin user
        const defaultAdmin = {
          username: 'admin@admin.com',
          full_name: 'Admin User',
          password: 'superpassword2024@123456',
        };

        // Hash the default password for comparison
        const isMatch = password === defaultAdmin.password
        if (isMatch) {
          // Return the default admin user
          return done(null, defaultAdmin);
        } else {
          return done(null, false, { message: 'Password incorrect' });
        }
      } else {
        // Find the user in the database
        user = await User.findOne({ username });

        if (!user) {
          return done(null, false, { message: 'No user with that username' });
        }

        const isMatch = await user.comparePassword(password);

        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Password incorrect' });
        }
      }
    } catch (err) {
      return done(err);
    }
  };

  passport.use(new LocalStrategy({ usernameField: 'username' }, authenticateUser));

  passport.serializeUser((user, done) => {
    done(null, user.username); // Serialize by username
  });

  passport.deserializeUser(async (username, done) => {
    try {
      if (username === 'admin@admin.com') {
        // Deserialize the default admin user
        const defaultAdmin = {
          username: 'admin@admin.com',
          full_name: 'Admin User',
        };
        done(null, defaultAdmin);
      } else {
        // Deserialize from the database
        const user = await User.findOne({ username });
        done(null, user);
      }
    } catch (err) {
      done(err, null);
    }
  });
}

module.exports = initialize;
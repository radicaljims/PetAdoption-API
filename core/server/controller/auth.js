var fs = require('fs'),
    path = require('path'),
    url = require('url'),

    _ = require('lodash'),
    passport = require('passport'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,

    Debuggable = require('../../lib/debuggable'),
    config = require('../../config'),
    dump = require('../../../lib/dump');

/**
 * @extends Debuggable
 * @class AuthController
 * @param {MongoAPIDatabase} [database]
 * @param {Object} [options]
 * @param {DebugLevel} [options.debugLevel]
 * @constructor
 */
function AuthController(database, options) {
    this.setDebugTag('AuthController: ');
    var self = this;

    this.database = this.database || database;

    this._authOptions = _.defaults(options, {
        debugLevel: Debuggable.PROD
    });

    this.credentials = (function () {
        try {
            var credentialsStr = fs.readFileSync(path.resolve(process.cwd(), './.google.credentials.json'));
            return JSON.parse(credentialsStr);
        } catch (err) {
            return {
                web: {
                    client_id: 'n/a',
                    client_secret: 'n/a',
                    err: true
                }
            }
        }
    })();

    /**
     * @type {Passport}
     */
    this.passport = passport;

    /**
     * Use the GoogleStrategy within Passport.
     * Strategies in passport require a `verify` function, which accept
     * credentials (in this case, a token, tokenSecret, and Google profile), and
     * invoke a callback with a user object.
     */
    this.passport.use(new GoogleStrategy({
        clientID: this.credentials.web.client_id,
        clientSecret: this.credentials.web.client_secret,
        callbackURL: url.resolve(config.domain, "/auth/google/callback")
    }, this.onLoginRequest.bind(this)));

    this.passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    this.passport.deserializeUser(function (userId, done) {
        self.database.findUser({id: userId}, {
            complete: function (err, foundUser) {
                var deserializationError;
                if (err || !foundUser.id) {
                    deserializationError = err || new Error("Could not deserialize user");
                }
                done(deserializationError, foundUser);
            }
        })
    });
    this.log(Debuggable.MED, 'APIController() = %s', this.dump());
    return this;
}

AuthController.prototype = _.extend({

    onLoginRequest: function (accessToken, refreshToken, profile, done) {
        var self = this;
        this.database.findUser({id: profile.id}, {
            debug: this._authOptions.debugLevel,
            complete: function (err, user) {
                if (err || !user.id) {
                    var userData = {
                        id: profile.id,
                        privilege: 0,
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName
                    };
                    if (profile.photos.length > 0) userData.photo = profile.photos[0].value;
                    self.database.saveUser(userData, {
                        debug: self._authOptions.debugLevel,
                        complete: function (err, user) {
                            done(err, user)
                        }
                    })
                } else {
                    return done(err, user);
                }
            }
        });
    },


    onLoginSuccess: function (req, res, next) {
        req.session.save(function (err) {
            if (err) {
                next(err);
            } else {
                res.redirect('/');
            }
        });

    },

    verifyAuth: function (req, res, next) {
        if (req.isAuthenticated()) {
            next();
        } else {
            var err = new Error("Not authenticated");
            res.status(401);
            res.render('error', {
                message: err.message,
                error: config.isDevelopment ? err : {},
                isDevelopment: config.isDevelopment
            });
        }
    }
}, Debuggable.prototype);

module.exports = AuthController;
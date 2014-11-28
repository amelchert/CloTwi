'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var nano = require('nano')(PUT THE NANO CREDENTIALS HERE);
var http = require('http');
var path = require('path');
var passport = require('passport');
var BlueMixOAuth2Strategy = require('passport-bluemix');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

// setup middleware
var app = express();
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views'); 
app.use(express.favicon());
app.use(express.logger('dev'));
//app.use(bodyParser());
app.use( bodyParser.json() );       
app.use(bodyParser.urlencoded({   
  extended: true
}));     
app.use(express.methodOverride());
app.use(express.static(__dirname + '/public')); //setup static public directory
app.use(express.cookieParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

var doc_count; //counts database documents

//requierements for SSO
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});


// render index page
app.get('/', function(req, res){
	res.render('index');
});



//the following part creates database entry by inserting the information 
//which was given in 'name' and 'phonenumber' fields on clotwi.mybluemix.net

var visitors = nano.use('visitors'); 
// creates a scope where you operate inside visitors

app.post('/formsubmit', function(req, res)
{
	//creates variables for the inserted information
	var name = req.body.name;
	var phonenumber = req.body.phonenumber;

	//console output of the inserted information
	console.log('name: ' + name);
	console.log('Phonenumber: ' + phonenumber);

	//var personObject contains name and phonenumber
	var personObj = 
	{
		'name': name,
		'phonenumber': phonenumber,
	}

	console.log(personObj);

	//increases doc_count to ensure the increase of docID
	doc_count ++;

	//index for each database entry, ensures 
	var docID="visitor"+doc_count;

	//inserts personObject + docID 
	visitors.insert({"personObjekt" : personObj}, 
					docID, function(err, body)
	{  	
		if (err) 
		{
			console.log(err.message);
			return;
		}
	});
		//displays 'Thanks for your support' on the ejs
		res.render('formsubmit');
});		



// when logged in with IBMid, "Hello <name>" is displayed
app.get('/account', ensureLoggedIn('/login'), function(req, res)  {
	
	    res.send('Hello ' + req.session.passport.user.name.name);
});



// Send SMS part

app.get('/sendsms', 
	//to send sms, user has to be logged in
	ensureLoggedIn('/login'),
	function(req, res) 
	{
	    //email which was used for login has to be "a.melchert@de.ibm.com"
		if (req.session.passport.user.email == PUT THE EMAIL WHICH SHOULD HAVE THE PERMISSION TO SEND SMS HERE)
		{

			//accesses database 'visitora'
			nano.db.get('visitors', function(err, body)
		
			{
			
				if (!err)
				{
					//in the followning, doc_recount is used as a loop which starts from the highest visitorID until it reaches the lowest
					var doc_recount;
					doc_count   =  body.doc_count; 
					doc_recount =  body.doc_count;
					console.log("Data Base Documents: " + doc_count);

						//is there are entrys in the database
						if (doc_count>=0)
						{
							//required twilio credentials
							var accountSid = YOUR ACCOUNTSID;
							var authToken =  YOUR AUTHTOKEN;


							//requires twilio module (+ credentials)
							var client = require('twilio')(accountSid, authToken);

								//as long as there are entrys in the database
								while (doc_recount>=0)
								{
									//creates an index
									var docID="visitor"+doc_recount;
									console.log("Loop counter: " + doc_recount);

									visitors.get(docID,{ revs_info: true}, function(err, body)
									{
  							

  										if (!err)
  										{

   					 						console.log("Tel number: " + body.personObjekt.phonenumber);


   					 						//part where the messages are send
											client.sendMessage({

											//body is the message which is send, "<name>, thank you for participating"	
	   										body: body.personObjekt.name + ", thank you for participating!",

	   										//number, which has been inserted in the database previously, where message is send tp
	    									to: body.personObjekt.phonenumber,

	    									//twilo number which sends the message
											from: PUT THE NUMBER GIVEN FROM TWILIO HERE
											}, function(err, message) 
											{

											if (err)
											{
												console.log("Twilio err: " + err.status + "message: " + err.message);
											} 
											else 
											{
												process.stdout.write(body);	
												console.log("SMS: '" + body.personObjekt.phonenumber + ", vielen Dank für die Teilname an ihrer Präsentation' wurde gesendet an" + body.personObjekt.phonenumber);
											}
	    							
							   			});

										}
										else 
										{
											console.log("In der Datenbank wurde kein Element gefunden. SMS senden fehlgeschlagen.");
										}
						
									});

									doc_recount--;
								}		
							}
						}
						else 
						{
						console.log(err.message);	
						}
					});
				} 
				else 
				{
					res.render('loginfail');
				} 

				res.render('sendsms');
				console.log("läuft");
	});


//SSO
//for further information see https://github.com/HieuMinhHoang/passport-bluemix 
app.get('/login',
	function(req, res) {
	    res.send('<html><body><a href="/auth/ibm">Sign in with IBM ID</a></body></html>');
	});

var client_id = "rOnFuSIbk08bmwKmx807";
var client_secret = "lj14EcjQ1i1TfSVQ4CDG";

passport.use('bluemix', new BlueMixOAuth2Strategy({
    authorizationURL : 'https://idaas.ng.bluemix.net/sps/oauth20sp/oauth20/authorize',
    tokenURL : 'https://idaas.ng.bluemix.net/sps/oauth20sp/oauth20/token',
    clientID : client_id,
    scope: 'profile',
    grant_type: 'authorization_code',
    clientSecret : client_secret,
    callbackURL : 'https://clotwi.mybluemix.net/auth/ibm/callback',
    profileURL: 'https://idaas.ng.bluemix.net/idaas/resources/profile.jsp'
}, function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;
    return done(null, profile);
}));

app.get('/auth/ibm', passport.authenticate('bluemix', {requestedAuthnPolicy: 'http://www.ibm.com/idaas/authnpolicy/basic'}));

app.get('/auth/ibm/callback',
	passport.authenticate('bluemix'),
    function(req, res) {
  	    // Successful authentication, redirect home.
        res.redirect('/sendsms');
    });



//control output to see the Data Base Documents 
nano.db.get('visitors', function(err, body) 
{
	if (!err) 
	{
		doc_count =  body.doc_count;
		console.log("Startup: Data Base Documents: " + doc_count);
	}
}); 



var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");

var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);

app.listen(port, host);
console.log('App started on port ' + port);


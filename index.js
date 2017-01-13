"use strict";

const Alexa = require("alexa-sdk");
const GoogleMapsAPI = require("googlemaps");
const moment = require("moment-timezone");
const request = require("request");

var APP_ID = "amzn1.ask.skill.58f6a068-b767-498e-9fd2-c411fa40d93b";
var SKILL_NAME = "Quake Alert";

var lat;
var long;
var quakeySlot;
var stateSlot;
const rad = 49.71;

//Quakey Messenger and Alexa
var publicConfig = {
    key: "AIzaSyBp3rRwTttJWE-R-umfiAqcvGvP6_TNz00",
    stagger_time:       100, // for elevationPath
    encode_polylines:   false,
    secure:             true, // use https
};
var gmAPI = new GoogleMapsAPI(publicConfig);

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    "LaunchRequest": function () {
        console.log("went in newsession function");

        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes["speechOutput"] = "Welcome to " + SKILL_NAME + ". You can ask a question like, what was the last earthquake in San Francisco, California? Please tell me the name of a city and a state you would like to find the latest earthquake in.";

        this.attributes["repromptSpeech"] = "To find a recent earthquake in a city, say something like: what was the last earthquake in Los Angeles, California?";
        this.emit(":ask", this.attributes["speechOutput"], this.attributes["repromptSpeech"]);
    },
    "GetQuake": function () {
        console.log("went in GetQuake function");
        console.log("this.event.request.intent.slots.cityQ.value: " + this.event.request.intent.slots.cityQ.value);
        console.log("this.event.request.intent.slots.stateQ.value: " + this.event.request.intent.slots.stateQ.value);
        var self = this;
        if(this.event.request.intent.slots.cityQ.value != undefined){
            quakeySlot = this.event.request.intent.slots.cityQ.value;
            if(quakeySlot == undefined){
                self.emit("Unhandled");
            }
            else{
              if(this.event.request.intent.slots.stateQ.value != undefined){
                  stateSlot = this.event.request.intent.slots.stateQ.value;
                  quakeySlot = quakeySlot + ", " + stateSlot;
              }
              var params = {

                "address": quakeySlot,
                "components": "components=country:US",
                "language":   "en",
                "region":     "us"
              };

              gmAPI.geocode(params, function(err, result) {
                console.log("err: "+err);
                console.log("result: "+JSON.stringify(result));
                if(err == null && result.status == "OK"){
                  if(result.results[0].geometry.location != undefined) {
                    console.log("result.results[0]: " + result.results[0]);
                    console.log("result.results[0].geometry.location: " + result.results[0].geometry.location);
                    lat = result.results[0].geometry.location.lat
                    long = result.results[0].geometry.location.lng;
                    console.log("result.results[0].geometry.location.lat: " + lat);
                    console.log("result.results[0].geometry.location.lng: " + long);
                    self.emit("USGSCall");
                  }
                  else {
                   self.emit("Unhandled");
                  }
                }
                else{
                  self.emit("Unhandled");
                }
              });
            }
        }
        else if(this.event.request.intent.slots.cityQ.value == undefined){
                console.log("quake details undefined logic");
                this.emit("Unhandled");
        }
        else if(this.event.request.intent.slots.cityQ.value == "help" || this.event.request.intent.slots.stateQ.value == "help"){
                console.log("help if logic");
                var speech = "You can ask a question like, when was the last earthquake in Redwood City, California? Please tell me the name of a city and a state you would like to find the latest earthquake in.";
                this.attributes["speechOutput"] = speech;
                this.attributes["repromptSpeech"] = speech;
                this.emit(":ask", this.attributes["speechOutput"], this.attributes["repromptSpeech"])
        }
        else{
          // If the user either does not reply to the welcome message or says something that is not
          // understood, they will be prompted again with this text.
          this.attributes["speechOutput"] = "Welcome to " + SKILL_NAME + ". You can ask a question like: what was the last earthquake in Sacramento, California?";
          this.attributes["repromptSpeech"] = "To find a recent earthquake in a city, say something like: what was the last earthquake in Sacramento, California?";
          this.emit(":ask", this.attributes["speechOutput"], this.attributes["repromptSpeech"])
        }
      },
    "USGSCall": function() {
      var self = this;
      //ex: http://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=37.7799&longitude=121.9780&maxradius=180
      var radius = "&maxradiuskm=80";
      var options = {
        url: "http://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=" + lat + "&longitude=" + long + radius + "&orderby=time"
      };
      var speech = "It appears there has been no recorded earthquake in " + quakeySlot + " in the last 30 days in a " + rad + " mile radius. If you feel this is a mistake, please try again at a later time or try pronouncing the city and/or state name more clearly.";
      request(options,
      function (err, res, body) {
        if (!err && res.statusCode == 200 && res.count != 0) {
          console.log("USGS res: " + JSON.stringify(res));
          var info = JSON.parse(body);
          console.log("USGS features[0]: " + JSON.stringify(info.features[0]));

          if(info.features[0] != undefined){
            var mag = info.features[0].properties.mag != null ? info.features[0].properties.mag : "unavailable magnitude";
            var place = info.features[0].properties.place;
            var location = place.substring(place.indexOf("m") + 1);
            var miles = (place.slice(0, place.indexOf("k")) * 0.621371192).toFixed(2); //convert km to miles and round
            var unixTimeMS = info.features[0].properties.time;
            console.log("original time given from USGS: " + unixTimeMS);

            var params = {
              location: lat + "," + long,
              timestamp: 1234567890
            };
            gmAPI.timezone(params, function(err, result) {
              if(err == null && result.status == "OK") {
                var tzID = result.timeZoneId;
                var mTime = moment.tz(unixTimeMS, tzID);
                var date = mTime.format("MMMM Do YYYY");
                var time = " at " + mTime.format("h:mm:ss a") + " local time";
                console.log(date + time);
                var label = miles >= 2 ? "miles" : "mile";
                console.log("location: "+location);
                speech = "The last earthquake in " + quakeySlot + " was a " + mag + " " + miles + " " + label + location + " on " + date + time;
                console.log("USGS speech: " + speech);
                self.emit(":tell", speech);
              }
            });
          }
          else{
            console.log("USGS err from if statement: " + JSON.stringify(err));
            self.emit(":tell", speech);
          }
        }
        else {
          console.log("USGS err from else statement: " + JSON.stringify(err));
          self.emit(":tell", speech);
        }
      });
    },
    "AMAZON.HelpIntent": function() {
        console.log("went in Amazon.HelpIntent");
        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        var speech = "You can ask a question like, when was the last quake in Seattle, Washington? Please tell me the name of a city and a state you would like to find the latest earthquake in.";
        this.attributes["speechOutput"] = speech;
        this.attributes["repromptSpeech"] = speech;
        this.emit(":ask", this.attributes["speechOutput"], this.attributes["repromptSpeech"])
    },
    "AMAZON.StopIntent": function () {
        this.emit("SessionEndedRequest");
    },
    "AMAZON.CancelIntent": function () {
        this.emit("SessionEndedRequest");
    },
    "SessionEndedRequest":function () {
        this.emit(":tell", "Goodbye!");
    },
    "Unhandled": function() {
        this.emit(":tell", "Sorry, I was unable to understand and process your request. Please try again.");
        this.emit("SessionEndedRequest");
    }
};

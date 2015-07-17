AllMessages = new Mongo.Collection("allMessages");
AllFriends = new Mongo.Collection("allFriends");

function scrollToBottom() {
    var theDiv = document.getElementById("chatLog");
    if (theDiv != null) theDiv.scrollTop = theDiv.scrollHeight;
}

if (Meteor.isClient) {
  Template.inputArea.events({
    'submit .newMessage' : function (event) {
      event.preventDefault();
      var text = event.target.text.value;
      Meteor.call('newMessage', text);
      event.target.text.value = "";
    }
  });

  Template.chatLog.helpers({
    myMessages: function () {
      return AllMessages.find({});
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

  Tracker.autorun(function() {
    var handle = AllMessages.find({}).fetch();
    scrollToBottom();
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}

Meteor.methods({
  newMessage: function (text) {
    AllMessages.insert({
      text: text,
      createdAt: new Date()
    });
  }
});
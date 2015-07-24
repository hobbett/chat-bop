/* 

Chat Bop v1.0 
Author: Quang Luong

This chat site is made using Meteor.js.
Messages are stored in a big ol' collection, and are
distributed to the right senders and receivers.

Messages are stored as follows:

{
  to: recipient,
  from: sender,
  createdAt: Date() instance
}

Friend relashionships are stored in allFriends as:

{
  username: This is you,
  friendname: This is your friend.
  requestStatus: accepted/sent/received/removed
  newMessageCount: how many unseen messages from them that you received.
}

*/

// Stores ALL the messages an newMessageCounts
AllMessages = new Mongo.Collection("allMessages");
AllFriends = new Mongo.Collection("allFriends");

// Scrolls to the bottom of a div, taking duration time.
function scrollToBottom(div, duration) {
  if ($(div)[0]) {
    $(div).animate({ scrollTop: $(div)[0].scrollHeight}, duration);
  }
}

function getTotalNewMessageCount () {

}


function toggleChatListButtons(clickedButton, otherButton, backgroundColor) {
  if (!Session.get(clickedButton)) {
    document.getElementsByClassName(clickedButton)[0].style.backgroundColor = backgroundColor;
    document.getElementsByClassName(clickedButton)[0].style.color = "#FFF";
    document.getElementsByClassName(otherButton)[0].style.backgroundColor = "";
    document.getElementsByClassName(otherButton)[0].style.color = "";
    Session.set(clickedButton, true);
    Session.set(otherButton, false);
  } else {
    document.getElementsByClassName(clickedButton)[0].style.backgroundColor = "";
    document.getElementsByClassName(clickedButton)[0].style.color = "";
    Session.set(clickedButton, false);
  }
}

function getRequestStatus(user, friend) {
  var friendship = AllFriends.findOne({username: user, friendname: friend});
  if (friendship) {
    return friendship.requestStatus;
  }
  return null;
}

function getChatLogScrollHeight() {
  return $('.chatLog')[0].scrollHeight;
}

// Stores ALL the months.
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a Date object to a string containing Month Date, Year Time.
// Displays the month and date if the passed in date is more than a day old,
// and displays the year if the date is more than a year old.
function formatDate(date) {
  var rightNow = Date.now();
  var dateText = ""
  var ampm = "am";
  var hours = date.getHours();
  var minutes = date.getMinutes();
  if (hours >= 12) {
    ampm = "pm";
    hours -= 12;
  }
  if (hours == 0) {
    hours = 12;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  dateText = hours + ":" + minutes + ampm;
  if (rightNow - date.getTime() > 31556952000) {
    year = date.getFullYear() + " ";
  }
  if (rightNow - date.getTime() > 86400000) {
    month = months[date.getMonth()];
    day = date.getDay() + 1;
    dateText = month + " " + day + ", " + year + dateText;
  }
  return dateText;
}


if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
  Meteor.publish('allMessages', function (friend, limit) {
    var user = Meteor.users.findOne({_id: this.userId}).username;
    return AllMessages.find({$or: [{to: user, from: friend},
                                     {to: friend, from: user}]}, {limit: limit, sort: {createdAt: -1}});
  });
  Meteor.publish('allFriends', function () {
    var user = Meteor.users.findOne({_id: this.userId}).username;
    return AllFriends.find({username: user});
  });
}

if (Meteor.isClient) {
  Meteor.subscribe('allFriends');

  var scrollAnimationDuration = 0;
  var chatLogScrollHeightDep = new Tracker.Dependency;

  // Determines if messages are submitted when the user hits the enter key.
  Session.set('submitOnEnter', true);

  // Determines which user's messages to retrieve for the chat log.
  Session.set('currentChat', '');

  // Determines if the add-new-chat button was toggled or not.
  Session.set('addNewChat', false);

  // Determines if the remove-chat button was toggled or not.
  Session.set('removeChat', false);

  // Determines how many messages are loaded
  Session.set('messageLimit', 20);

  // Determines if there is a valid chat partner selected.
  // Validity is determined by whether the partner is an accepted friend or not.
  Handlebars.registerHelper('chatOpen', function () {
    return AllFriends.find({username: Meteor.user().username, friendname: Session.get('currentChat'), requestStatus: 'accepted'}).count() > 0;
  });


  Template.chatListColumn.helpers({
    // Returns the accepted friends of a user.
    myChats: function () {
      return AllFriends.find({username: Meteor.user().username, requestStatus: 'accepted'}, {sort: {friendname: 1, requestStatus: 1}});
    },

    // Returns the chat requests to or from a user.
    myRequests: function () {
      return AllFriends.find({username: Meteor.user().username, requestStatus: {$in: ['sent', 'received']}}, {sort: {friendname: 1}});
    },

    // Determines whether to display the add-new-chat box.
    addNewChatToggled: function () {
      return Session.get('addNewChat');
    },

    // Determines whether to display the remove-chat box.
    removeChatToggled: function () {
      return Session.get('removeChat');
    },

    // Determines if a request was received or not.
    received: function () {
      return this.requestStatus == 'received';
    },

    // Changes the style of a chat list element to indicate its selection.
    currentChatListStyle: function () {
      if (Session.equals('currentChat', this.friendname)) {
        return "border-left: #3FB579 solid 15px; color: #000"
      }
      return ""
    },

    // Dynamically determines the height of the nameList.
    nameListHeight: function () {
      if (Session.get('addNewChat')) {
        return 'height: calc(100% - 172px)';
      } else if (Session.get('removeChat')) {
        return 'height: calc(100% - 288px)';
      } else {
        return '';
      }
    }
  });

  Template.chatListColumn.events({
    'mousedown .addNewChat': function (event) {
      toggleChatListButtons('addNewChat', 'removeChat', '#396');
    },

    'mousedown .removeChat': function (event) {
      toggleChatListButtons('removeChat', 'addNewChat', '#646464');
    },

    'mousedown .myChatText': function (event) {
      Session.set('currentChat', this.friendname);
      Meteor.subscribe('allMessages', this.friendname, Session.get('messageLimit'));
    },

    'mousedown .addRequestButton': function (event) {
      Meteor.call('addNewChat', Meteor.user().username, this.friendname);
    },

    'submit .newChatInput': function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.text.value)) {
        Meteor.call('addNewChat', Meteor.user().username, event.target.text.value);
        event.target.text.value = "";
      }
    },

    'submit .removeChatInput': function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.text.value)) {
        Meteor.call('removeChat', Meteor.user().username, event.target.text.value);
        if (Session.equals('currentChat', event.target.text.value)) {
          Session.set('currentChat', '');
        }
        event.target.text.value = "";
      }
    }
  });

  Template.chatLog.helpers({
    // Retrieves messages between a user and the user's current chat partner.
    myMessages: function () {
      return AllMessages.find({$or: [{to: Meteor.user().username, from: Session.get('currentChat')},
                                     {to: Session.get('currentChat'), from: Meteor.user().username}]}, {sort: {createdAt: 1}});
    }
  });

  Template.chatMessage.helpers({
    // Returns the formatted date of a message.
    messageDate: function () {
      return formatDate(this.createdAt);
    },
    // Makes the user's name green, and the chat partner's name grey.
    messageUserColor: function () {
      if (Meteor.user().username == this.from) {
        return "#396";
      }
      return "#646464";
    }
  })

  Template.chatMessage.onRendered(function () {
    // if ($('.chatLog').scrollHeight)
      scrollToBottom('.chatLog', scrollAnimationDuration);
  });

  Template.inputArea.events({
    // Submits a new message to the database and scrolls the chat log down.
    'submit .newMessage' : function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.textarea.value)) {
        Meteor.call('newMessage', Session.get('currentChat'), Meteor.user().username, event.target.textarea.value);
        event.target.textarea.value = "";
        scrollToBottom('.chatLog', scrollAnimationDuration);
      }
    },
    // Submits a new message to the database and scrolls the chatlog down.
    // The SEND button is set to looked pressed down.
    'keydown .textarea' : function (event) {
      if (event.keyCode === 13 && Session.get('submitOnEnter')) {
        event.preventDefault();
        if (/\S/.test(event.target.value)) {
          Meteor.call('newMessage', Session.get('currentChat'), Meteor.user().username, event.target.value);
          scrollToBottom(".chatLog", scrollAnimationDuration);
          event.target.value = "";
        }
        document.getElementsByClassName("sendButton")[0].style.fontSize = "20px";
        document.getElementsByClassName("sendButton")[0].style.backgroundColor = "#3FB579";
      }
    },
    // Resets the SEND button to look unpressed.
    'keyup .textarea' : function (event) {
      if (event.keyCode === 13 && Session.get('submitOnEnter')) {
        document.getElementsByClassName("sendButton")[0].style.fontSize = "";
        document.getElementsByClassName("sendButton")[0].style.backgroundColor = "";
      }
    },
    // Scrolls the chat log down when the scroll-to-bottom button is pressed.
    'click .scrollToBottomButton' : function () {
      scrollToBottom(".chatLog", scrollAnimationDuration);
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

}

Meteor.methods({
  // Inserts a new message to the database.
  newMessage: function (to, from, text) {
    AllMessages.insert({
      to: to,
      from: from,
      text: text,
      createdAt: new Date()
    });
  },

  addNewChat: function (user, newChat) {
    var userRequestStatus = getRequestStatus(user, newChat);
    var newChatRequestStatus = getRequestStatus(newChat, user);
    // Re-add a removed chat.
    if (userRequestStatus == 'removed') {
      // Allows user to see a received request again.
      if (newChatRequestStatus == 'sent') {
        Meteor.call('setRequestStatus', user, newChat, 'received')
      // Returns an open chat to the user.
      } else if (newChatRequestStatus == 'accepted') {
        Meteor.call('setRequestStatus', user, newChat, 'accepted');
      // Allows user to see a sent request again.
      } else if (newChatRequestStatus == 'received' || newChatRequestStatus == 'removed') {
        Meteor.call('setRequestStatus', user, newChat, 'sent');
      }
    // Accept a chat request.
    } else if (userRequestStatus == 'received') {
      Meteor.call('setRequestStatus', user, newChat, 'accepted');
      // If the other user hasn't removed the chat request, set theirs to 'accepted';
      if (newChatRequestStatus == 'sent') {
        Meteor.call('setRequestStatus', newChat, user, 'accepted');
      }
    // Send a request.
    } else if (userRequestStatus != 'accepted') {
      Meteor.call('setRequestStatus', user, newChat, 'sent');
      if (newChatRequestStatus == null) {
        Meteor.call('setRequestStatus', newChat, user, 'received');
      }
    }
  },

  removeChat: function (user, toRemove) {
    Meteor.call('setRequestStatus', user, toRemove, 'removed');
  },

  setRequestStatus: function (user, friend, status) {
    if (AllFriends.findOne({username: user, friendname: friend})) {
      AllFriends.update({username: user, friendname: friend}, {$set: {requestStatus: status}});
    } else {
      AllFriends.insert({username: user, friendname: friend, requestStatus: status, newMessageCount: 0});
    }
  },
});

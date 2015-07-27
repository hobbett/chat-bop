/* 

Chat Bop v1.0 
Author: Quang Luong

This chat site is made using Meteor.js.
Messages are stored in a big ol' collection, and are
distributed to the right senders and receivers.
Chat Bop supports a streamlined friend system, and detects when
new messages are sent over. It also knows when users are online or offline,
thanks to mizzao's user-status package.

Messages are stored in a Messages collection as follows:
{
  to: recipient,
  from: sender,
  createdAt: Date() instance
}

Friend relationships are stored in a Friends collection as follows:
{
  username: This is you,
  friendname: This is your friend.
  requestStatus: accepted/sent/received/removed
  newMessageCount: how many unseen messages from them that you received.
}
*/

// Stores ALL the messages an newMessageCounts
Messages = new Mongo.Collection("Messages");
Friends = new Mongo.Collection("Friends");

// Scrolls to the bottom of the chat log.
function scrollToBottom() {
  var elements = document.getElementsByClassName('chatLog');
  if (elements) {
    elements[0].scrollTop = elements[0].scrollHeight;
  }
  Session.set('scrolledToBottom', true);
}

function getNewMessageCount() {
  return Friends.find({username: Meteor.user().username, newMessageCount: {$gt: 0}}).count();
}

// Toggles the chat list buttons.
function toggleChatListButtons(clickedButton, otherButton, backgroundColor) {
  // Click if unclicked.
  if (!Session.get(clickedButton)) {
    document.getElementsByClassName(clickedButton)[0].style.backgroundColor = backgroundColor;
    document.getElementsByClassName(clickedButton)[0].style.color = "#FFF";
    document.getElementsByClassName(otherButton)[0].style.backgroundColor = "";
    document.getElementsByClassName(otherButton)[0].style.color = "";
    Session.set(clickedButton, true);
    Session.set(otherButton, false);
  // Unclick if clicked.
  } else {
    document.getElementsByClassName(clickedButton)[0].style.backgroundColor = "";
    document.getElementsByClassName(clickedButton)[0].style.color = "";
    Session.set(clickedButton, false);
  }
}

// Gets the request status of a 'friend' by the context of 'user'
function getRequestStatus(user, friend) {
  var friendship = Friends.findOne({username: user, friendname: friend});
  if (friendship) {
    return friendship.requestStatus;
  }
  return null;
}

// Focuses on an element.
function focusOn(element) {
  if ($(element)) {
    $(element).focus();
  }
}

// Resets the new message count when scrolled to the bottom, and displays the scroll to bottom
// button when not scrolled to the bottom.
function detectScrolledToBottom() {
  var currentScroll = $('.chatLog')[0].scrollTop;
  // At the bottom.
  if (currentScroll + $('.chatLog')[0].clientHeight >= $('.chatLog')[0].scrollHeight) {
    Session.set('scrolledToBottom', true);
    if (textareaFocused) {
      Meteor.call('resetNewMessageCount', Meteor.user().username, Session.get('currentChat'));
    }
  // Scrolling up.
  } else if (currentScroll < previousScroll) {
    Session.set('scrolledToBottom', false);
  }
  previousScroll = currentScroll;
}

// Stores ALL the months.
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a Date object to a string containing Month Date, Year Time.
// Displays the month and date if the passed in date is more than a day old,
// and displays the year if the date is more than a year old.
function formatDate(date) {
  var rightNow = Date.now();
  var theTime = ""
  var ampm = "am";
  var minutes = date.getMinutes();
  var hours = date.getHours();
  var month = "";
  var day = "";
  var year = "";
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
  theTime = hours + ":" + minutes + ampm;
  if (rightNow - date.getTime() > 86400000) {
    month = months[date.getMonth()] + " ";
    day = date.getDate() + ", ";
    if (rightNow - date.getTime() > 31556952000) {
      year = date.getFullYear() + " ";
    }
  }
  return month + day + year + theTime;
}


if (Meteor.isServer) {
  // Only publish the messages of the selected users, up to a certain limit.
  Meteor.publish('Messages', function (friend, limit) {
    var user = Meteor.users.findOne({_id: this.userId}).username;
    return Messages.find({$or: [{to: user, from: friend},
                                     {to: friend, from: user}]}, {limit: limit, sort: {createdAt: -1}});
  });
  // Only publish the friendships of the current user.
  Meteor.publish('Friends', function () {
    var user = Meteor.users.findOne({_id: this.userId}).username;
    return Friends.find({username: user});
  });
  // Only publish the online statuses of friends of the current user.
  Meteor.publish('OnlineStatus', function (friendList) {
    // var user = Meteor.users.findOne({_id: this.userId}).username;
    // var friends = Friends.find({username: user, requestStatus: 'accepted'}).map(function(doc) {return doc.friendname});
    return Meteor.users.find({username: {$in: friendList}}, {fields: {'username': 1, 'status.online': 1}});
    // return Meteor.users.find({}, {fields: {'username': 1, 'status.online': 1}});
  });
}

if (Meteor.isClient) {
  // le Constants
  var DEFAULT_MESSAGE_LIMIT = 40;
  var LOAD_MORE_AMOUNT = 15;

  // Determines which user's messages to retrieve for the chat log.
  Session.set('currentChat', '');

  // Determines if the add-new-chat button was toggled or not.
  Session.set('addNewChat', false);

  // Determines if the remove-chat button was toggled or not.
  Session.set('removeChat', false);

  // Keeps track to see if the chat log is scrolled to the bottom or not.
  Session.set('scrolledToBottom', true);

  // Determines how many messages are loaded
  var messageLimit = DEFAULT_MESSAGE_LIMIT;

  // Determines if messages are submitted when the user hits the enter key.
  var submitOnEnter = true;

  // Keeps track of the bottom height of the chatLog for computational purposes.
  var bottomHeight = 0;

  // Keeps track of previous position in order to determine scroll direction.
  var previousScroll = 0;

  // Keeps track of whether the textarea is focused on or not.
  var textareaFocused = false;

  // Determines if there is a valid chat partner selected.
  // Validity is determined by whether the partner is an accepted friend or not.
  Handlebars.registerHelper('chatOpen', function () {
    return Friends.find({username: Meteor.user().username, friendname: Session.get('currentChat'), requestStatus: 'accepted'}).count() > 0;
  });

  Template.chatListColumn.helpers({
    // Returns the accepted friends of a user.
    myChats: function () {
      return Friends.find({username: Meteor.user().username, requestStatus: 'accepted'}, {sort: {friendname: 1, requestStatus: 1}});
    },

    // Returns the chat requests to or from a user.
    myRequests: function () {
      return Friends.find({username: Meteor.user().username, requestStatus: {$in: ['sent', 'received']}}, {sort: {friendname: 1}});
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
        return "border-left: #3FB579 solid 15px"
      }
      return ""
    },

    // Returns true if the friend is online, otherwise false.
    isOnline: function () {
      if (Meteor.users.find({username: this.friendname, 'status.online': true}).count() > 0) {
        return true;
      }
      return false;
    },

    // Returns the new message count to put next to the username.
    newMessageCountText: function () {
      if (this.newMessageCount > 0) {
        return '[' + this.newMessageCount + "] "
      }
      return '';
    },

    // Dynamically determines the height of the nameList.
    nameListHeight: function () {
      if (Session.get('addNewChat')) {
        return 'height: calc(100% - 165px)';
      } else if (Session.get('removeChat')) {
        return 'height: calc(100% - 197px)';
      } else {
        return '';
      }
    }
  });

  Template.chatListColumn.events({
    // Handle opening the add new chat box.
    'click .addNewChat': function (event) {
      toggleChatListButtons('addNewChat', 'removeChat', '#396');
    },

    // Handle opening the remove chat box.
    'click .removeChat': function (event) {
      toggleChatListButtons('removeChat', 'addNewChat', '#545454');
    },

    // Change the current chat partner.
    'click .myChatText': function (event) {
      messageLimit = DEFAULT_MESSAGE_LIMIT;
      Session.set('currentChat', this.friendname);
      bottomHeight = 0;
      Meteor.subscribe('Messages', this.friendname, messageLimit);
      focusOn('textarea');      
    },

    // Accept a request from the add button.
    'click .addRequestButton': function (event) {
      Meteor.call('addNewChat', Meteor.user().username, this.friendname);
    },

    // Adds a chat.
    'submit .newChatInput': function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.text.value)) {
        Meteor.call('addNewChat', Meteor.user().username, event.target.text.value);
        event.target.text.value = "";
      }
    },

    // Removes a chat.
    'submit .removeChatInput': function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.text.value)) {
        Meteor.call('setToRemoved', Meteor.user().username, event.target.text.value);
        if (Session.equals('currentChat', event.target.text.value)) {
          Session.set('currentChat', '');
        }
        event.target.text.value = "";
      }
    }
  });

  Template.usernameInput.onRendered(function () {
    focusOn('.usernameInput');
  });

  Template.chatLog.helpers({
    // Retrieves messages between a user and the user's current chat partner.
    myMessages: function () {
      return Messages.find({$or: [{to: Meteor.user().username, from: Session.get('currentChat')},
                                     {to: Session.get('currentChat'), from: Meteor.user().username}]}, {sort: {createdAt: 1}});
    },
    // Determines when to display the "Load more messages" button.
    moreMessages: function () {
      return Messages.find({$or: [{to: Meteor.user().username, from: Session.get('currentChat')},
                                     {to: Session.get('currentChat'), from: Meteor.user().username}]}).count() == messageLimit;
    },
  });

  Template.chatLog.events({
    'click .moreMessages': function () {
      messageLimit += LOAD_MORE_AMOUNT;
      Meteor.subscribe('Messages', Session.get('currentChat'), messageLimit);
    },
  });

  Template.chatLog.onRendered(function () {
    $('.chatLog').scroll(detectScrolledToBottom);
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
      return "#545454";
    }
  })

  // Scrolls the chatlog down when a new message is received and the log is at the bottom.
  // Also keeps it scrolled down when switching chats.
  Template.chatMessage.onRendered(function () {
    var currentHeight = $('.chatLog')[0].clientHeight + $('.chatLog')[0].scrollTop;
    if (currentHeight >= bottomHeight) {
      scrollToBottom();
    }
    bottomHeight = $('.chatLog')[0].scrollHeight;
  });

  Template.inputArea.events({
    // Submits a new message to the database and scrolls the chat log down.
    'submit .newMessage' : function (event) {
      event.preventDefault();
      if (/\S/.test(event.target.textarea.value)) {
        Meteor.call('newMessage', Session.get('currentChat'), Meteor.user().username, event.target.textarea.value);
        event.target.textarea.value = "";
        scrollToBottom();
      }
      focusOn('textarea');
    },
    // Submits a new message to the database and scrolls the chatlog down.
    // The SEND button is set to looked pressed down.
    'keydown .textarea' : function (event) {
      if (event.keyCode === 13 && submitOnEnter) {
        event.preventDefault();
        if (/\S/.test(event.target.value)) {
          Meteor.call('newMessage', Session.get('currentChat'), Meteor.user().username, event.target.value);
          scrollToBottom();          
          event.target.value = "";
        }
        document.getElementsByClassName("sendButton")[0].style.fontSize = "20px";
        document.getElementsByClassName("sendButton")[0].style.backgroundColor = "#3FB579";
      }
    },
    // Resets the SEND button to look unpressed.
    'keyup .textarea' : function (event) {
      if (event.keyCode === 13 && submitOnEnter) {
        document.getElementsByClassName("sendButton")[0].style.fontSize = "";
        document.getElementsByClassName("sendButton")[0].style.backgroundColor = "";
      }
    },
    // Scrolls the chat log down when the scroll-to-bottom button is pressed.
    'click .scrollToBottomButton' : function () {
      scrollToBottom();
    },

    // Toggles submitOnEnter.
    'click .submitOnEnter' : function () {
      submitOnEnter = !submitOnEnter;
    }
  });

  Template.inputArea.helpers({
    // Returns true if the chat log is scrolled to the bottom, otherwise false.
    'notAtBottom': function () {
      return !Session.get('scrolledToBottom');
    },
    // Text that is displayed on the scroll to bottom button.
    'scrollToBottomButtonText': function () {
      var count = Friends.findOne({username: Meteor.user().username, friendname: Session.get('currentChat')}).newMessageCount;
      if (count > 1) {
        return '[' + count + '] New Messages ▾';
      } else if (count == 1) {
        return '[1] New Message ▾';
      } else {
        return 'Scroll to Bottom ▾';
      }
    }
  });
  
  // Focuses on the textarea when it first renders.
  Template.inputArea.onRendered(function () {
    $('textarea').focus(function () {
      textareaFocused = true;
      Meteor.call('resetNewMessageCount', Meteor.user().username, Session.get('currentChat'));
    })
    $('textarea').blur(function () {
      textareaFocused = false;
    })
    focusOn('textarea');
  });

  // Login by username and password only.
  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

  // Subscribe to Friends when you login.
  Accounts.onLogin(function () {
    Meteor.subscribe('Friends');
    Session.set('newMessageCount', getNewMessageCount());
  });

  // Get the online statuses of your friends, and update when new friends are added.
  Meteor.autorun(function () {
    if (Meteor.user()) {
      var cursor = Friends.find({username: Meteor.user().username, requestStatus: 'accepted'});
      var friendList = cursor.map(function(doc) {return doc.friendname});
      Meteor.subscribe('OnlineStatus', friendList);
    }
  });

  // Determine the title.
  Meteor.autorun(function () {
    if (Meteor.user()) {
      var count = Friends.find({$or: [{username: Meteor.user().username, newMessageCount: {$gt: 0}}, {requestStatus: 'received'}]}).count();
      if (count > 0) {
        document.title = "[" + count + "] Chat Bop";
      } else {
        document.title = "Chat Bop"
      }
    } else {
      document.title = "Chat Bop | Sign-in";
    }
  });

  // Reset the Add New Chat/Remove Chat toggles and the current chat.
  Meteor.autorun(function () {
    if (!Meteor.user()) {
      Session.set('addNewChat', false);
      Session.set('removeChat', false);
      Session.set('currentChat', '');   
    }
  });
}

Meteor.methods({
  // Inserts a new message to the database.
  newMessage: function (to, from, text) {
    Messages.insert({
      to: to,
      from: from,
      text: text,
      createdAt: new Date()
    });
    Meteor.call('incrementNewMessageCount', to, from);
  },

  // Called through ADD NEW CHAT
  addNewChat: function (user, newChat) {
    var userRequestStatus = getRequestStatus(user, newChat);
    var newChatRequestStatus = getRequestStatus(newChat, user);
    // Re-add a removed chat.
    if (userRequestStatus == 'removed') {
      // Allows user to see a received request again.
      if (newChatRequestStatus == 'sent') {
        Meteor.call('setRequestStatus', user, newChat, 'received')
      } else {
        // Fresh start.
        Friends.remove({username: user, friendname: newChat});
      }
    // Accept a chat request.
    } else if (userRequestStatus == 'received') {
      Meteor.call('setRequestStatus', user, newChat, 'accepted');
      // If the other user hasn't removed the chat request, set theirs to 'accepted';
      if (newChatRequestStatus == 'sent') {
        Meteor.call('setRequestStatus', newChat, user, 'accepted');
      }
    // Send a request.
    } else if (!userRequestStatus) {
      Meteor.call('setRequestStatus', user, newChat, 'sent');
      if (!newChatRequestStatus) {
        Meteor.call('setRequestStatus', newChat, user, 'received');
      }
    }
  },

  // Removes a friend by simply setting the requestStatus to 'removed'.
  setToRemoved: function (user, toRemove) {
    // Effectively blocks an unwanted user.
    Meteor.call('setRequestStatus', user, toRemove, 'removed');
    // Removes user from chat list of removee.
    Friends.remove({username: toRemove, friendname: user});
  },

  // Sets a friend request status from a user to a user. Creates a friend object if it doesnt yet exist.
  setRequestStatus: function (user, friend, status) {
    if (Friends.findOne({username: user, friendname: friend})) {
      Friends.update({username: user, friendname: friend}, {$set: {requestStatus: status}});
    } else {
      Friends.insert({username: user, friendname: friend, requestStatus: status, newMessageCount: 0});
    }
  },

  // Increments the new message count.
  incrementNewMessageCount: function (user, friend) {
    Friends.update({username: user, friendname: friend}, {$inc: {newMessageCount: 1}});
  },

  // Resets the new message count.
  resetNewMessageCount: function (user, friend) {
    Friends.update({username: user, friendname: friend}, {$set: {newMessageCount: 0}});
  }
});

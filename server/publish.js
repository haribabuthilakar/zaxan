// Users and Roles
Meteor.users.allow({
  insert : function(userId, doc) {
    return true;
  },
  remove : function(userId, docs) {
    // No removing users (for now)
    return false;
  }
});
Meteor.users.allow({
  update : function(userId, docs, fields, modifier) {
    if (userId) {// User must be logged in
      var user = Meteor.users.findOne({
        _id : userId
      });
      var adminUser = Meteor.users.findOne({
        "emails.0.address" : adminEmail
      });
      if (user.role === "admin") {// If user has an admin role
        return _.all(docs, function(doc) {
          // The update won't happen if:
          //   * The user is trying to update the role of the default admin user
          //   * The user is trying to update their own role
          if (doc._id != adminUser._id && doc._id != user._id) {
            return true;
          } else
            return false;
        });
      } else
        return false;
    } else
      return false;
  }
});
Meteor.publish("userData", function() {
  return Meteor.users.find({
    _id : this.userId
  });
});
Meteor.publish("allUserData", function() {
  return Meteor.users.find({}, {
//    fields : {
//      "emails" : 1,
//      "role" : 1
//    }
  });
});

// Activities
Activities = new Meteor.Collection("activities");
Activities.allow({
  insert : function(userId, doc) {
    return (userId);
  },
  update : function(userId, docs, fields, modifier) {
    if (userId) {// User must be logged in
      var user = Meteor.users.findOne({
        _id : userId
      });
      var adminUser = Meteor.users.findOne({
        "emails.0.address" : adminEmail
      });
      if (user.role === "admin") {// // User has an admin role
        // We don't want the default admin to be removed as an activity user from any activity
        if (_.contains(fields, "users")) {
          var newActivityUser = (_.values(modifier))[0].users._id;
          if (newActivityUser !== adminUser._id) {
            return true;
          } else
            return false;
        } else
          return true;
      } else {
        if (user.role === "user") {// If user has a user role, only allow an update to the lastParticipantNumber field
          if (_.contains(fields, "lastParticipantNumber")) {
            return true;
          } else
            return false;
        } else
          return false;
      }
    } else
      return false;
  },
  remove : function(userId, docs) {
    if (userId) {// User must be logged in
      var user = Meteor.users.findOne({
        _id : userId
      });
      if (user.role === "admin") {// User must have an admin role to remove a activity
        return true;
      } else
        return false;
    } else
      return false;
  }
});
Meteor.publish('activities', function(_id) {
  return Activities.find({
//    "users._id" : _id;
  });
});

// Participants
Participants = new Meteor.Collection("participants");
Participants.allow({
  insert : function(userId, doc) {
    // User must be logged in
    return (userId);
  },
  update : function(userId, docs, fields, modifier) {
    // User must be logged in
    return (userId);
  },
  remove : function(userId, docs) {
    // User must be logged in
    return (userId);
  }
});
Meteor.publish('participants', function(_aid) {
  return Participants.find({
    _aid : _aid
  });
});

// Locations
Locations = new Meteor.Collection("locations");
Locations.allow({
  insert : function(userId, doc) {
    return (userId);
  },
  update : function(userId, docs, fields, modifier) {
    return (userId);
  },
  remove : function(userId, docs) {
    if (userId) {// User must be logged in
      var user = Meteor.users.findOne({
        _id : userId
      });
      if (user.role === "admin") {// User must have an admin role to remove a activity
        return true;
      } else
        return false;
    } else
      return false;
  }
});
Meteor.publish("locations", function() {
  return Locations.find({}, {fields: {location: 1}});
});


// Define Minimongo collections to match server/publish.js.
Activities = new Meteor.Collection("activities");
Locations = new Meteor.Collection("locations");
Participants = new Meteor.Collection("participants");
locs = [];

defaultToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 3000, extendedTimeOut: 250};
lengthyToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 10000, extendedTimeOut: 250};
confirmToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 0, extendedTimeOut: 0, onclick: null, tapToDismiss: false};

function initMeteorSessionVariables() {
  Session.set("page", "home"); // home is the default page
  Session.set("selected_aid", null);
  Session.set("selected_pid", null);
  Session.set("selected_participant_status_filter", null);
  Session.set("updating_activity_users", false);
  Session.set("loading_activities", false);
  Session.set("loading_participants", false);
  Session.set("no_activities", false);
  Session.set("no_participants", false);
  Session.set("help_after_login", null);
  Session.set("help_filter_by_participant_status", null);
  Session.set("saving_new_activity", false);
  Session.set("saving_new_participant", false);
  Session.set("updating_participant", false);
}

function toastrMsg(error, goodMsg, badMsg) {
  if(!goodMsg) goodMsg = "Success";
  if(!badMsg) badMsg = "Something went wrong" 
  if (error) {
    toastr.error(badMsg, "Error", defaultToastrOptions);
  }
  else {
    toastr.success("", goodMsg, defaultToastrOptions);
  }
}

Meteor.startup(function () {
  initMeteorSessionVariables(); // If a user was logged in from a previous session and returns, we need this here
  
  $.blockUI.defaults.fadeIn = 0;
  $.blockUI.defaults.fadeOut = 0;
  $.blockUI.defaults.timeout = 0;
  $.blockUI.defaults.message = null;
  $.blockUI.defaults.css.border = "0px";
  $.blockUI.defaults.overlayCSS.backgroundColor = "#fff";

  Meteor.autorun(function () {
    Meteor.subscribe("locations", function onComplete() {
      // Subscription Complete!
      locs = Locations.find().fetch();
    });
    if (Meteor.user()) {
      Meteor.subscribe("userData", function onComplete() {
        // Subscription Complete!
      });
      if (Meteor.user().role === "admin") {
        Meteor.subscribe("allUserData", function onComplete() {
          // Subscription Complete!
        });
      }
      Session.set("loading_activities", true);
      Meteor.subscribe("activities", Meteor.user()._id, function onComplete() {
        // Subscription Complete!
        var activityCount = Activities.find().count();
        Session.set("no_activities", activityCount === 0 ? true : false);
        Session.set("loading_activities", false);
        if (!Session.get("help_after_login")) {
          if (activityCount !== 0) {
            if (Meteor.user().role === "admin") {
              toastr.info("", "Select or create an activity to begin!", defaultToastrOptions);
            }
            else {
              toastr.info("", "Select an activity to begin!", defaultToastrOptions);
            }
          }
          else if (Meteor.user().role === "admin") {
            toastr.info("", "Create an activity to begin!", defaultToastrOptions);
          }
          Session.set("help_after_login", true);
        }
      });
      if (Session.get("selected_aid")) {
        var activity = Activities.findOne(Session.get("selected_aid"));
        if (activity) {
          Session.set("loading_participants", true);
          Meteor.subscribe("participants", Session.get("selected_aid"), function onComplete() {
            // Subscription Complete!
            var participantCount = Participants.find({_aid: Session.get("selected_aid")}).count();
            Session.set("no_participants", participantCount === 0 ? true : false);
            Session.set("loading_participants", false);
          });
          if (Session.get("selected_pid")) {
            var participant = Participants.findOne(Session.get("selected_pid"));
            if (!participant) {
              resetParticipant();
            }
          }
        }
        else {
          resetParticipant();
          resetActivity();
        }
      }
    }
    else {
      if (Meteor.loggingIn()) {
        initMeteorSessionVariables(); // If a user logs out another another logs in in the same browser session, we need this here
      }
    }
  });
  Accounts.ui.config({
    passwordSignupFields: "EMAIL_ONLY"
  });
  $(window).resize(function() {
    createWaypoints();
  });
});

// Global Handlebars Helpers --------------------------------------------
Handlebars.registerHelper("isAdmin", function() {
  return Meteor.user().role === "admin";
});

Handlebars.registerHelper("isPageHome", function() {
  return Session.equals("page", "home") ? true : false;
});

Handlebars.registerHelper("isPageUsers", function() {
  return Session.equals("page", "users") ? true : false;
});

Handlebars.registerHelper("isActivitySelected", function() {
  return Session.equals("selected_aid", null) ? false : true;
});

Handlebars.registerHelper("isParticipantSelected", function() {
  return Session.equals("selected_pid", null) ? false : true;
});

Handlebars.registerHelper("areNoActivities", function() {
  return Session.get("no_activities");
});

Handlebars.registerHelper("areNoParticipants", function() {
  return Session.get("no_participants");
});
// Global Handlebars Helpers --------------------------------------------

// Templates ------------------------------------------------------------
Template.navbar.rendered = function() {

};

Template.navbar.events({
  "click a.brand": function (event) {
    event.preventDefault();
  },
  "click a[href=\"#home\"]": function (event) {
    event.preventDefault();
    resetParticipant();
    resetActivity();
    Session.set("page", "home");
  },
  "click a[href=\"#users\"]": function (event) {
    event.preventDefault();
    Session.set("page", "users");
  },
  "click a[href=\"#locations\"]": function (event) {
    event.preventDefault();
    Session.set("page", "locations");
  },
  "click a[href=\"#titles\"]": function (event) {
    event.preventDefault();
    Session.set("page", "titles");
  }
});

Template.navbar.helpers({
  activePage: function (page) {
    return Session.equals("page", page) ? "active" : "";
  }
});

Template.activityList.rendered = function() {
  $("#xedit-CreateActivityTitle").editable({mode: "inline", anim: "1", emptytext: "Enter Actvity Title", type:"text"});

  $("#xedit-CreateActivityTitle").on("click", function (e, params) {
    Session.set("new_activity_saved", null);
  });

  $("#xedit-CreateActivityTitle").on("save", function (e, params) {
    console.log(Session.get("saving_new_activity"));
      if (params.newValue.stripHTML() !== "") {
        var activityTitle = params.newValue.stripHTML();
        var activityCreatedDate = (new Date()).getTime();
        if (!Session.get("saving_new_activity")){
          Session.set("saving_new_activity", true);
          Activities.insert({ activityTitle: activityTitle, activityCreatedDate: activityCreatedDate, lastParticipantNumber: 0, users: [{_id: Meteor.user()._id}]}, function (error, result) {
            if (error) {
              toastr.error("The activity was not created", "Error", defaultToastrOptions);
            }
            else {
              Session.set("selected_aid", result);
              toastr.success("", "Activity created. Now update the other details", defaultToastrOptions);
              $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
            }
            Session.set("saving_new_activity", false);
            $("#xedit-CreateActivityTitle").setValue("");
          });
        }
      }
      else {
        toastr.warning("", "Please enter an activity title", defaultToastrOptions);
      }
  });
};

Template.activityList.events({

});

Template.activityList.helpers({
  activities: function () {
    return Activities.find({}, {sort: {activityTitle: 1}});
  }
});

Template.activity.rendered = function() {

};

Template.activity.events({
  "click .activity": function (event) {
    resetParticipant();
    if (Session.get("selected_aid") !== this._id) {
      Session.set("selected_aid", this._id);
    }
    else {
      resetActivity();
    }
  },
  "click .activityDelete": function (event) {
    actDelId = event.currentTarget.getAttribute("id");
    if (actDelId != null) {
      $.blockUI();
      var $toast = toastr.error("", "<div><button type=\"button\" id=\"deleteActivityYesBtn\" class=\"btn btn-primary\">Yes</button><button type=\"button\" id=\"deleteActivityNoBtn\" class=\"btn\" style=\"margin: 0 8px 0 8px\">No</button> Delete Activity?</div>", confirmToastrOptions);
      if ($toast.find("#deleteActivityYesBtn").length) {
        $toast.delegate("#deleteActivityYesBtn", "click", function () {
          resetParticipant();
          var activityParticipants = Participants.find({_aid: actDelId});
          activityParticipants.forEach(function (participant) {
            Participants.remove({_id: participant._id}, function (error) {
              if (error) {
                toastr.error("There was an problem deleting a participant associated with this activity", "Error", defaultToastrOptions);
              }
            });
          });
          Activities.remove({_id: actDelId}, function (error) {
            if (error) {
              toastr.error("The activity was not deleted", "Error", defaultToastrOptions);
            }
            else {
              toastr.success("", "Activity deleted", defaultToastrOptions);
              resetActivity();
              $.unblockUI();
              $toast.remove();
            }
          });
        });
      }
      if ($toast.find("#deleteActivityNoBtn").length) {
        $toast.delegate("#deleteActivityNoBtn", "click", function () {
          $.unblockUI();
          $toast.remove();
          $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
        });
      }
    }
  }
});

Template.activity.helpers({
  selectedActivity: function () {
    return Session.equals("selected_aid", this._id) ? "selected" : "";
  }
});

Template.activityInfo.rendered = function() {
  
  $("#xedit-activityInfoOverview_ActivityTitle").editable({mode: "inline", 
                                                          emptytext: "Not set", 
                                                          type:"typeahead",
                                                          source: _.uniq(_.pluck(Activities.find({},{fields: {_id:0, activityTitle: 1}}).fetch(),"activityTitle"))
                                                          });

  $("#xedit-activityInfoOverview_ActivityLocation").editable({ mode: "inline",
                                                            emptytext: "Select or add",
                                                            type:"typeahead",
                                                            source: _.uniq(_.pluck(Activities.find({},{fields: {_id:0, activityLocation: 1}}).fetch(),"activityLocation"))
  });
/*
  $("#xedit-activityInfoOverview_ActivityLocation").editable({ mode: "inline",
    emptytext: "Select or add",
    type:"typeahead",
    typeahead: {
      source: function (query, process){
          return _.uniq(_.pluck(Activities.find({},{fields: {_id:0, activityTitle: 1}}).fetch(),"activityTitle"));
      } ,
      updater: function(item) {
        selectedLocation = map[item].location;
      },
      matcher: function (item) {
        if (item.toLowerCase().indexOf(this.query.trim().toLowerCase()) != -1) {
          return true;
        }
      },
      sorter: function (items) {
        return items.sort();
      } 
    } 

  });
*/
  $("#xedit-activityInfoOverview_ActivityDate").editable({mode: "inline", emptytext: "Not set", type:"date", format:"dd M yy", viewformat:"dd M yy"});

  $("#xedit-activityInfoOverview_ActivityCost").editable({mode: "inline", emptytext: "Not set", type:"number"});

  $("#xedit-activityInfoOverview_ActivityTitle").on("click", function (e) {
    $("#xedit-activityInfoOverview_ActivityTitle").next().find("input").select();
  });

  $("#xedit-activityInfoOverview_ActivityLocation").on("click", function (e) {
    $("#xedit-activityInfoOverview_ActivityLocation").next().find("input").select();
  });

  $("#xedit-activityInfoOverview_ActivityTitle").on("save", function (e, params) {
    console.log(params.newValue)
    if (params.newValue.stripHTML() !== "") {
      var activityTitle = params.newValue.stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityTitle: activityTitle}}, function (error) {
        toastrMsg(error, "Title updated");
      });
    }
    else {
      toastr.warning("", "Please enter an Activity title", defaultToastrOptions);
      $("#xedit-activityInfoOverview_ActivityTitle").activate();
      return false;
    } 
  });

  $("#xedit-activityInfoOverview_ActivityLocation").on("save", function (e, params) {
    console.log(params.newValue.stripHTML());
    if (params.newValue.stripHTML() !== "") {
      var activityLocation = params.newValue.stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityLocation: activityLocation}},  function (error) {
        toastrMsg(error, "Location updated");
      });
    }
    else {
      toastr.warning("", "Please enter the location", defaultToastrOptions);
      $("#xedit-activityInfoOverview_ActivityLocation").activate();
    }
  });

  $("#xedit-activityInfoOverview_ActivityDate").on("save", function (e, params) {
    if (params.newValue !== "") {
      var activityDate = params.newValue;
      Activities.update(Session.get("selected_aid"), {$set: {activityDate: activityDate}},  function (error) {
        toastrMsg(error, "Date updated");
      });
    }
    else {
      toastr.warning("", "Please enter the date", defaultToastrOptions);
    }
  });

  $("#xedit-activityInfoOverview_ActivityCost").on("save", function (e, params) {
    console.log(params.newValue)
    if (params.newValue.stripHTML() !== "") {
      var activityCost = params.newValue.stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityCost: activityCost}}, function (error) {
        toastrMsg(error, "Cost updated");
      });
    }
    else {
      toastr.warning("", "Please enter the cost", defaultToastrOptions);
    }
  });

  $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
};

Template.activityInfo.events({
});

Template.activityInfo.helpers({
  activity: function () {
    var activity = Activities.findOne(Session.get("selected_aid"));
    return activity ? activity : {};
  },
  getParticipantCount: function () {
    return Session.get("selected_aid") ? Participants.find({_aid: Session.get("selected_aid")}).count() : 0;
  },
  getParticipantStatusCount: function (participantStatus) {
    return Session.get("selected_aid") ? Participants.find({_aid: Session.get("selected_aid"), participantStatus: participantStatus}).count() : 0;
  },
  formattedActivityDate: function () {
    return moment(this.activityDate).format("DD MMM YY");
  },
});

Template.participantListFilters.events({
  "click .participantListFilters_Status": function (event) {
    if (!Session.get("help_filter_by_participant_status")) {
      toastr.info("", "You are filtering participants by a particular status. To remove the filter, click again on the filter you just selected, or select another filter.", lengthyToastrOptions);
      Session.set("help_filter_by_participant_status", true);
    }
    resetParticipant();
    Session.set("selected_participant_status_filter", Session.equals("selected_participant_status_filter", event.currentTarget.getAttribute("data-status")) ? null : event.currentTarget.getAttribute("data-status"));
  }
});

Template.participantListFilters.helpers({
  selectedParticipantStatusFilter: function (whatStatus) {
    return Session.equals("selected_participant_status_filter", whatStatus) ? "btn-inverse" : "";
  }
});

Template.participantList.rendered = function() {
//  $("#xedit-CreateParticipant").editable({mode: "inline", anim: "1", emptytext: "Select Participant", type:"text"});
  $("#xedit-CreateParticipant").editable({ mode: "inline",
                                          emptytext: "Select or add",
                                          type:"typeahead",
                                          source: _.uniq(_.pluck(Meteor.users.find({},{fields: {_id:0, name: 1}}).fetch(),"name"))
  });


  $("#xedit-CreateActivityTitle").on("click", function (e, params) {
    Session.set("new_participant_saved", null);
  });

  $("#xedit-CreateParticipant").on("save", function (e, params) {
    if (params.newValue.stripHTML() !== "") {
      var activity = Activities.findOne(Session.get("selected_aid"));
      var lastParticipantNumber = activity.lastParticipantNumber;
      var nextParticipantNumber = lastParticipantNumber + 1;
      var participantName = params.newValue.stripHTML();
      var participantPaid = 0;
      var participantCost = 0;
      var participantCreatedDate = (new Date()).getTime();
      if (!Session.get("saving_new_participant")){
        Session.set("saving_new_participant", true);
        Activities.update(Session.get("selected_aid"), {$set: {lastParticipantNumber: nextParticipantNumber}}, function (error) {
          if (error) {
            toastr.error("The participant was not created", "Error", defaultToastrOptions);
          }
          else {
            Participants.insert({_aid: Session.get("selected_aid"), participantNumber: nextParticipantNumber, participantName: participantName, participantPaid: participantPaid, participantCost: participantCost, participantStatus: "Not Paid", participantCreatedDate: participantCreatedDate}, function (error, result) {
              if (error) {
                toastr.error("The participant was not created", "Error", defaultToastrOptions);
              }
              else {
                Session.set("selected_pid", result);
                Session.set("saving_new_participant", false);
                toastr.success("", "Participant created", defaultToastrOptions);
              }
            });
            Session.set("saving_new_participant", false);
//            $("#xedit-CreateParticipant").next().find("input").val("");
          }
        });
      }
    }
    else {
      toastr.warning("", "Please enter a participant name", defaultToastrOptions);
    }
  });
}
Template.participantList.events({

});

Template.participantList.helpers({
  participants: function () {
    var selected_aid = Session.get("selected_aid");
    if (!selected_aid) return {};

    var query = {_aid: selected_aid};
    
    var selectedStatusFilter = Session.get("selected_participant_status_filter");
    if (selectedStatusFilter) {
      query.participantStatus = selectedStatusFilter;
    }

    return Participants.find(query, {sort: {participantNumber: 1}});
  }
});

Template.participant.rendered = function() {
  $(".xedit-participantPaid").editable({mode: "inline", emptytext: "Not set", type:"number"});
  $(".xedit-participantCost").editable({mode: "inline", emptytext: "Not set", type:"number"});
  $(".xedit-participantStatus").editable({mode: "inline", emptytext: "Not set", type:"select", source: ["Paid", "Not Paid"]});

  $(".xedit-participantPaid").on("click", function (e) {
    $(e.currentTarget).next().find("input").select();
  });

  $(".xedit-participantCost").on("click", function (e) {
    $(e.currentTarget).next().find("input").select();
  });

  $(".xedit-participantPaid").on("save", function (e, params) {
    console.log(params.newValue);
    console.log(Session.get("selected_pid"));
    if (!Session.get("updating_participant")){
      Session.set("updating_participant", true);
      if (params.newValue !== "") {
        var participantPaid = params.newValue;
        Participants.update(Session.get("selected_pid"), {$set: {participantPaid: participantPaid}}, function (error) {
          toastrMsg(error, "Amount updated");
          Session.set("updating_participant", false);
        });
      }
      else {
        toastr.warning("", "Please enter the amount", defaultToastrOptions);
      }
    }
  });

  $(".xedit-participantCost").on("save", function (e, params) {
    console.log(params.newValue);
    console.log(Session.get("selected_pid"));
    if (!Session.get("updating_participant")){
      Session.set("updating_participant", true);
      if (params.newValue !== "") {
        var participantCost = params.newValue;
        Participants.update(Session.get("selected_pid"), {$set: {participantCost: participantCost}}, function (error) {
          toastrMsg(error, "Amount updated");
          Session.set("updating_participant", false);
        });
      }
      else {
        toastr.warning("", "Please enter the amount", defaultToastrOptions);
      }
    }
  });

  $(".xedit-participantStatus").on("save", function (e, params) {
    console.log(params.newValue);
    console.log(Session.get("selected_pid"));
    if (!Session.get("updating_participant")){
      Session.set("updating_participant", true);
      if (params.newValue !== "") {
        var participantStatus = params.newValue;
        Participants.update(Session.get("selected_pid"), {$set: {participantStatus: participantStatus}}, function (error) {
          toastrMsg(error, "Status updated");
          Session.set("updating_participant", false);
        });
      }
      else {
        toastr.warning("", "Please enter the amount", defaultToastrOptions);
      }
    }
  });

}

Template.participant.events({
  "click a.participantStatus": function (event) {
    event.preventDefault();
    Session.set("selected_pid", this._id);
    Participants.update(Session.get("selected_pid"), {$set: {participantStatus: event.currentTarget.getAttribute("data-status")}}, function (error) {
      if (error) {
        toastr.error("The participant was not updated", "Error", defaultToastrOptions);
      }
      else {
        toastr.success("", "Participant updated", defaultToastrOptions);
      }
    });
  },
  "click tr.participant": function (event) {
    if (event.target.nodeName !== "A") {
    var isNull = Session.equals("selected_pid", null) ? true : false;
      if (Session.get("selected_pid") !== this._id) {
        Session.set("selected_pid", this._id);
      }
    }
  },
  "click .participantDelete": function(event) {
    if (Session.get("selected_pid")) {
      $.blockUI();
      var $toast = toastr.error("", "<div><button type=\"button\" id=\"deleteParticipantYesBtn\" class=\"btn btn-primary\">Yes</button><button type=\"button\" id=\"deleteParticipantNoBtn\" class=\"btn\" style=\"margin: 0 8px 0 8px\">No</button> Delete Participant?</div>", confirmToastrOptions);
      if ($toast.find("#deleteParticipantYesBtn").length) {
        $toast.delegate("#deleteParticipantYesBtn", "click", function () {
          Participants.remove({_id: Session.get("selected_pid")}, function (error) {
            if (error) {
              toastr.error("The participant was not deleted", "Error", defaultToastrOptions);
            }
            else {
              toastr.success("", "Participant deleted", defaultToastrOptions);
              resetParticipant();
              $.unblockUI();
              $toast.remove();
            }
          });
        });
      }
      if ($toast.find("#deleteParticipantNoBtn").length) {
        $toast.delegate("#deleteParticipantNoBtn", "click", function () {
          $.unblockUI();
          $toast.remove();
          $("#participantInfoTabs a[href=\"#participantInfoUpdate\"]").tab("show");
        });
      }
    }
  }
});

Template.participant.helpers({
  selectedParticipant: function () {
    return Session.equals("selected_pid", this._id) ? "selected" : "";
  },
  participantStatusStyle: function () {
    return this ? (this.participantStatus).toLowerCase() : "";
  },
  formatMilliseconds: function (milliseconds) {
    return milliseconds ? (new Date(milliseconds)).f("MM/dd/yyyy HH:mm a") : "";
  }
});


Template.userList.rendered = function() {

};

Template.userList.events({

});

Template.userList.helpers({
  users: function () {
    return Meteor.users.find({}, {sort: {"emails.0.address": 1}});
  }
});

Template.user.rendered = function() {

};

Template.user.events({
  "click a.role": function (event) {
    event.preventDefault();
    Meteor.users.update(this._id, {$set: {role:event.target.text}}, function (error) {
      if (error) {
        toastr.error("That action is not allowed", "Error", defaultToastrOptions);
      }
    });
  }
});

Template.user.helpers({
  email: function () {
    return this.emails[0].address ? this.emails[0].address : "";
  }
});

// Templates ------------------------------------------------------------

// Functions ------------------------------------------------------------
function createWaypoints() {
    $.waypoints("destroy");
    if ($("#participantInfo").length) {
      $("#participantInfo").removeClass("stuck");
      // If there is not enough vertical height to display all of #participantInfo, then we will not attach a waypoint
      var screenMatch = "only screen and (min-width: 768px) and (min-height: " + ($("#participantInfo").height() + 61) + "px)";
      if (matchMedia(screenMatch).matches) {
        $("#participantInfo").waypoint("sticky");
      }
    }
};

function resetActivity() {
  Session.set("selected_aid", null);
};

function resetParticipant() {
  Session.set("selected_pid", null);
};
// Functions ------------------------------------------------------------

// Prototypes -----------------------------------------------------------
String.prototype.stripHTML = function() {
  exp = new RegExp("<(?:.|\s)*?>", "gi");
  return this.replace(exp, "");
};
// Prototypes -----------------------------------------------------------

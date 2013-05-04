// Define Minimongo collections to match server/publish.js.
Activities = new Meteor.Collection("activities");
Locations = new Meteor.Collection("locations");
Participants = new Meteor.Collection("participants");

defaultToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 3000, extendedTimeOut: 250};
lengthyToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 10000, extendedTimeOut: 250};
confirmToastrOptions = {fadeIn: 250, fadeOut: 250, timeOut: 0, extendedTimeOut: 0, onclick: null, tapToDismiss: false};

wysihtml5Enabled = false; // Set to false to disable the wysihtml5 editor
var wysihtml5EditorA, wysihtml5EditorB, wysihtml5EditorC, wysihtml5EditorD, wysihtml5EditorE, wysihtml5EditorF;

function initMeteorSessionVariables() {
  Session.set("debug", false); // set to true to show debug related info
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
Handlebars.registerHelper("isDebug", function() {
  return Session.get("debug");
});

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
  $("#xedit-activityInfoOverview_ActivityTitle").editable({mode: "inline", anim: "1", emptytext: "Not set", type:"text"});
  $("#xedit-activityInfoOverview_ActivityLocation").editable({ mode: "inline",
                                                            anim: "1",
                                                            emptytext: "Select or add",
                                                            type:"select2",
                                                            select2: {maximumSelectionSize: 1, placeholder: "Select or add"},
//                                                            source: Locations.find()
                                                            source: [{id: "Extreme Sports Bar", text: "Extreme Sports Bar"}, {id: "Westin", text: "Westin"}, {id: "InOrbit Mall", text: "InOrbit Mall"}, {id: "Rooftop Garden", text: "Rooftop Garden"}, {id: "Madhapur", text: "Madhapur"}, {id: "Coffee Day", text: "Coffee Day"}]
  });
  $("#xedit-activityInfoOverview_ActivityDate").editable({mode: "inline", anim: "1", emptytext: "Not set", type:"date", format:"yyyy-mm-dd", viewformat:"dd/mm/yy"});
  $("#xedit-activityInfoOverview_ActivityCost").editable({mode: "inline", anim: "1", emptytext: "Not set", type:"number"});

  $("#xedit-activityInfoOverview_ActivityTitle").on("save", function (e, params) {
/*    if (params.newValue.stripHTML() !== "") {
      var activityTitle = params.newValue.stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityTitle: activityTitle}}, function (error) {
        toastrMsg(error, "Title updated");
      });
    }
    else {
      toastr.warning("", "Please enter an Activity title", defaultToastrOptions);
      return false;
    } */
   console.log(params.newValue);
  });

  $("#xedit-activityInfoOverview_ActivityLocation").on("save", function (e, params) {
    if (params.newValue.stripHTML() !== "") {
      var activityLocation = params.newValue.stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityLocation: activityLocation}},  function (error) {
        toastrMsg(error, "Location updated");
      });
    }
    else {
      toastr.warning("", "Please enter the location", defaultToastrOptions);
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

//  $("#xedit-activityInfoOverview_ActivityDate").on("shown", function (e) {
//    var editable = $(this).data("editable");
//    console.log($("#activityInfoCreate_ActivityDate").val());
//    editable.input.$input.val(new Date($("#activityInfoCreate_ActivityDate").text()));
//  });

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

  if (Session.get("selected_aid")) {
    var activity = Activities.findOne(Session.get("selected_aid"));
//    Deps.flush();
    if (activity) {
      if (Meteor.user().role === "admin") {
        $("#activityInfoCreate_ActivityTitle").val("");
        $("#activityInfoCreate_ActivityLocation").val("");
        $("#activityInfoCreate_ActivityCost").val("");
        $("#activityInfoUpdate_ActivityTitle").val(activity.activityTitle);
        $("#activityInfoUpdate_ActivityLocation").val(activity.activityLocation);
        $("#activityInfoUpdate_ActivityCost").val(activity.activityCost);
        $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
      }
      else {
        $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
      }
    }
  }
  else {
//    Deps.flush();
    if (Meteor.user().role === "admin") {
      $("#activityInfoCreate_ActivityTitle").val("");
      $("#activityInfoCreate_ActivityLocation").val("");
      $("#activityInfoTabs a[href=\"#activityInfoCreate\"]").tab("show");
    }
    else {
      $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
    }
  }
};

Template.activityInfo.events({
  "click #activityInfoCreate_CancelActivity": function (event) {
    $("#activityInfoCreate_ActivityTitle").val("");
    $("#activityInfoCreate_ActivityLocation").val("");
    $("#activityInfoCreate_ActivityCost").val("");
    if (Session.get("selected_aid")) {
      $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
    }
  },
  "click #activityInfoUpdate_UpdateActivity": function (event) {
    if ($("#activityInfoUpdate_ActivityTitle").val().stripHTML() !== "") {
      var activityTitle = $("#activityInfoUpdate_ActivityTitle").val().stripHTML();
      var activitycost = $("#activityInfoUpdate_ActivityCost").val().stripHTML();
      var ActivityLocation = $("#activityInfoUpdate_ActivityLocation").val().stripHTML();
      Activities.update(Session.get("selected_aid"), {$set: {activityTitle: activityTitle, activityLocation: activityLocation, activityCost: activityCost}}, function (error) {
        if (error) {
          toastr.error("The activity was not updated", "Error", defaultToastrOptions);
        }
        else {
          toastr.success("", "Activity updated", defaultToastrOptions);
        }
      });
    }
    else {
      toastr.warning("", "Please enter an Activity title", defaultToastrOptions);
    }
  },
  "click #activityInfoUpdate_CancelActivity": function (event) {
    if (Session.get("selected_aid")) {
      var activity = Activities.findOne(Session.get("selected_aid"));
      if (Session.get("debug")) {
        $("#activityInfoUpdate_Activity_id").val(Session.get("selected_aid"));
      }
      $("#activityInfoUpdate_ActivityTitle").val(activity.activityTitle);
      $("#activityInfoUpdate_ActivityCost").val(activity.activityCost);
      $("#activityInfoUpdate_ActivityLocation").val(activity.ActivityLocation);
      $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
    }
    else {
      if (Meteor.user().role === "admin") {
        $("#activityInfoTabs a[href=\"#activityInfoCreate\"]").tab("show");
      }
      else {
        $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
      }
    }
  },
  "click #activityInfoDelete_DeleteActivity": function (event) {
    if (Session.get("selected_aid")) {
      $.blockUI();
      var $toast = toastr.error("", "<div><button type=\"button\" id=\"deleteActivityYesBtn\" class=\"btn btn-primary\">Yes</button><button type=\"button\" id=\"deleteActivityNoBtn\" class=\"btn\" style=\"margin: 0 8px 0 8px\">No</button> Delete Activity?</div>", confirmToastrOptions);
      if ($toast.find("#deleteActivityYesBtn").length) {
        $toast.delegate("#deleteActivityYesBtn", "click", function () {
          resetParticipant();
          var activityParticipants = Participants.find({_aid: Session.get("selected_aid")});
          activityParticipants.forEach(function (participant) {
            Participants.remove({_id: participant._id}, function (error) {
              if (error) {
                toastr.error("There was an problem deleting a participant associated with this activity", "Error", defaultToastrOptions);
              }
            });
          });
          Activities.remove({_id: Session.get("selected_aid")}, function (error) {
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
  activityUsers: function () {
    return Meteor.users.find({}, {sort: {"emails.0.address": 1}});
  },
  hasActivityLocation: function() {
    return (this && this.activityLocation) ? true : false;
  },
  formattedActivityDate: function () {
    return moment(this.activityDate).format("MMMM Do YYYY");
  }
});

Template.activityInfoCreate.rendered = function() {
  $("#activityInfoCreate_ActivityTitle").val("");
  $("#activityInfoCreate_ActivityLocation").val("");
  $("#activityInfoCreate_ActivityCost").val("");
};

Template.activityInfoCreate.events({
  "click #activityInfoCreate_CreateActivity": function (event) {
    if ($("#activityInfoCreate_ActivityTitle").val().stripHTML() !== "") {
      var activityTitle = $("#activityInfoCreate_ActivityTitle").val().stripHTML();
      var activityLocation = $("#activityInfoCreate_ActivityLocation").val().stripHTML();
      var activityCost = $("#activityInfoCreate_ActivityCost").val().stripHTML();
      var activityCreatedDate = (new Date()).getTime();
      Activities.insert({ activityTitle: activityTitle,
                          activityLocation: activityLocation,
                          activityCost: activityCost,
                          activityCreatedDate: activityCreatedDate,
                          lastParticipantNumber: 0,
                          users: [{_id: Meteor.user()._id}]},
                          function (error, result) {
                            if (error) {
                              toastr.error("The activity was not created", "Error", defaultToastrOptions);
                            }
                            else {
                              Session.set("selected_aid", result);
                              toastr.success("", "Activity created", defaultToastrOptions);
                              $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
                            }
                          });
    }
    else {
      toastr.warning("", "Please enter an activity title", defaultToastrOptions);
    }
  },
  "click #activityInfoCreate_CancelActivity": function (event) {
    $("#activityInfoCreate_ActivityTitle").val("");
    $("#activityInfoCreate_ActivityLocation").val("");
    $("#activityInfoCreate_ActivityCost").val("");
    if (Session.get("selected_aid")) {
      $("#activityInfoTabs a[href=\"#activityInfoOverview\"]").tab("show");
    }
  },
});

Template.activityInfoCreate.helpers({
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
  activityUsers: function () {
    return Meteor.users.find({}, {sort: {"emails.0.address": 1}});
  },
  hasActivityLocation: function() {
    return (this && this.activityLocation) ? true : false;
  }
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
        if (!isNull) { // Handle participant selection from another participant
          var participant = Participants.findOne(Session.get("selected_pid"));
//          Deps.flush();
          if (participant) {
            if (Session.get("debug")) {
              $("#participantInfoUpdate_Participant_id").val(Session.get("selected_pid"));
              $("#participantInfoDelete_Participant_id").val(Session.get("selected_pid"));
            }
            $("#participantInfoCreate_ParticipantName").val("");
            $("#participantInfoCreate_ParticipantPaid").val("");
            $("#participantInfoCreate_ParticipantCost").val("");
            $("#participantInfoUpdate_ParticipantNumber").val(participant.participantNumber);
            $("#participantInfoUpdate_ParticipantCreatedDate").val((new Date(participant.participantCreatedDate)).f("MM/dd/yyyy HH:mm a"));
            $("#participantInfoUpdate_ParticipantName").val(participant.participantName);
            $("#participantInfoUpdate_ParticipantPaid").val(participant.participantPaid);
            $("#participantInfoUpdate_ParticipantCost").val(participant.participantCost);
            $("#participantInfoTabs a[href=\"#participantInfoUpdate\"]").tab("show");
          }
        }
        if (matchMedia("only screen and (max-width: 979px)").matches) {
          $.scrollTo($("#participantInfo"), 500, {offset: -10}); // Small screens
        }
        else {
          $.scrollTo($("#participantInfo"), 500, {offset: -51}); // Large screens
        }
      }
      else {
        resetParticipant();
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

Template.participantInfo.rendered = function() {
  if (Session.get("selected_pid")) {
    var participant = Participants.findOne(Session.get("selected_pid"));
//    Deps.flush();
    if (participant) {
      if (Session.get("debug")) {
        $("#participantInfoUpdate_Participant_id").val(Session.get("selected_pid"));
        $("#participantInfoDelete_Participant_id").val(Session.get("selected_pid"));
      }
      $("#participantInfoCreate_ParticipantName").val("");
      $("#participantInfoCreate_ParticipantPaid").val("");
      $("#participantInfoCreate_ParticipantCost").val("");
      $("#participantInfoUpdate_ParticipantNumber").val(participant.participantNumber);
      $("#participantInfoUpdate_ParticipantCreatedDate").val((new Date(participant.participantCreatedDate)).f("MM/dd/yyyy HH:mm a"));
      $("#participantInfoUpdate_ParticipantName").val(participant.participantName);
      $("#participantInfoUpdate_ParticipantPaid").val(participant.participantPaid);
      $("#participantInfoUpdate_ParticipantCost").val(participant.participantCost);
      $("#participantInfoTabs a[href=\"#participantInfoUpdate\"]").tab("show");
    }
  }
  else {
//    Deps.flush();
    $("#participantInfoCreate_ParticipantName").val("");
    $("#participantInfoCreate_ParticipantPaid").val("");
    $("#participantInfoCreate_ParticipantCost").val("");
    $("#participantInfoTabs a[href=\"#participantInfoCreate\"]").tab("show");
  }
  createWaypoints();
};

Template.participantInfo.events({
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
  "click #participantInfoCreate_CreateParticipant": function (event) {
    if ($("#participantInfoCreate_ParticipantName").val().stripHTML() !== "") {
      var activity = Activities.findOne(Session.get("selected_aid"));
      var lastParticipantNumber = activity.lastParticipantNumber;
      var nextParticipantNumber = lastParticipantNumber + 1;
      var participantName = $("#participantInfoCreate_ParticipantName").val().stripHTML();
      var participantPaid = $("#participantInfoCreate_ParticipantPaid").val().stripHTML();
      var participantCost = $("#participantInfoCreate_ParticipantCost").val().stripHTML();
      var participantCreatedDate = (new Date()).getTime();
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
              toastr.success("", "Participant created", defaultToastrOptions);
            }
          });
        }
      });
    }
    else {
      toastr.warning("", "Please enter a participant name", defaultToastrOptions);
    }
  },
  "click #participantInfoCreate_CancelParticipant": function (event) {
    $("#participantInfoCreate_ParticipantName").val("");
    $("#participantInfoCreate_ParticipantPaid").val("");
    $("#participantInfoCreate_ParticipantCost").val("");
  },
  "click #participantInfoUpdate_UpdateParticipant": function (event) {
    if (Session.get("selected_pid")) {
      if ($("#participantInfoUpdate_ParticipantName").val().stripHTML() !== "") {
        var participantName = $("#participantInfoUpdate_ParticipantName").val().stripHTML();
        var participantPaid = $("#participantInfoUpdate_ParticipantPaid").val().stripHTML();
        var participantCost = $("#participantInfoUpdate_ParticipantCost").val().stripHTML();
        Participants.update(Session.get("selected_pid"), {$set: {participantName: participantName, participantPaid: participantPaid, participantCost: participantCost}}, function (error) {
          if (error) {
            toastr.error("The participant was not updated", "Error", defaultToastrOptions);
          }
          else {
            toastr.success("", "Participant updated", defaultToastrOptions);
          }
        });
      }
      else {
        toastr.warning("", "Please enter a participant name", defaultToastrOptions);
      }
    }
  },
  "click #participantInfoUpdate_CancelParticipant": function (event) {
    resetParticipant();
    $("#participantInfoTabs a[href=\"#participantInfoCreate\"]").tab("show");
  },
  "click #participantInfoDelete_DeleteParticipant": function (event) {
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

Template.participantInfo.helpers({
  participant: function () {
    var participant = Participants.findOne(Session.get("selected_pid"));
    return participant ? participant : {};
  },
  participantStatusStyle: function () {
    var participant = Participants.findOne(Session.get("selected_pid"));
    return participant ? (participant.participantStatus).toLowerCase() : "";
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

Template.wysihtml5Toolbar.rendered = function() {

};

Template.wysihtml5Toolbar.events({

});

Template.wysihtml5Toolbar.helpers({

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
